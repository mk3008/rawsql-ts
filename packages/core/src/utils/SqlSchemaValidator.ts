import { SchemaCollector, TableSchema } from '../transformers/SchemaCollector';
import { SqlComponent } from '../models/SqlComponent';
import { TableColumnResolver } from '../transformers/TableColumnResolver';
import { SelectQueryParser } from '../parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../models/SimpleSelectQuery';
import { JoinUsingClause, TableSource } from '../models/Clause';
import { CTECollector } from '../transformers/CTECollector';
import { TableSourceCollector } from '../transformers/TableSourceCollector';

/** Stable diagnostic codes returned by static schema validation. */
export type SqlSchemaValidationDiagnosticCode =
    | 'COLUMN_NOT_DEFINED'
    | 'COLUMN_REFERENCE_AMBIGUOUS'
    | 'COLUMN_REFERENCE_UNRESOLVED'
    | 'TABLE_NOT_DEFINED';

/** One table or column resolution failure found without executing SQL. */
export interface SqlSchemaValidationDiagnostic {
    code: SqlSchemaValidationDiagnosticCode;
    columnName?: string;
    columnNames?: string[];
    message: string;
    tableName?: string;
}

/** Structured result for callers that need proven failures and unresolved limitations as data. */
export interface SqlSchemaValidationResult {
    diagnostics: SqlSchemaValidationDiagnostic[];
    /** True when no schema-invalid reference was proven; unresolved limitations may remain. */
    valid: boolean;
}

// API output shape review: schema validation returns diagnostics only and does
// not transform SQL or expose generated SQL text.

/**
 * Validates SQL query structures against known tables and columns.
 *
 * @example
 * ```typescript
 * const tables = [
 *   { name: 'users', columns: ['id', 'email'] }
 * ];
 *
 * SqlSchemaValidator.validate('SELECT id FROM users', tables);
 * ```
 * Related tests: packages/core/tests/utils/SqlSchemaValidator.validate.test.ts
 */

export class SqlSchemaValidator {
    /**
     * Analyzes table and column references without throwing for domain-invalid SQL.
     * Syntax parsing remains the caller's responsibility when a string is supplied.
     */
    public static analyze(
        sql: string | SqlComponent,
        tableResolver: TableColumnResolver | TableSchema[]
    ): SqlSchemaValidationResult {
        const sqlComponent = typeof sql === 'string' ? SelectQueryParser.parse(sql) : sql;
        const resolver = Array.isArray(tableResolver)
            ? (tableName: string) => {
                const schema = tableResolver.find((table) => table.name === tableName);
                return schema ? schema.columns : [];
            }
            : tableResolver;
        const schemaAnalysis = new SchemaCollector(resolver).analyze(sqlComponent);
        const tableSchemas = schemaAnalysis.schemas;
        const diagnostics: SqlSchemaValidationDiagnostic[] = [];
        const unresolvedColumnNames = [...new Set(schemaAnalysis.unresolvedColumns)];

        if (unresolvedColumnNames.length > 0) {
            const resolution = classifyUnqualifiedColumns(sqlComponent, resolver, unresolvedColumnNames);
            if (resolution.ambiguous.length > 0) {
                diagnostics.push({
                    code: 'COLUMN_REFERENCE_AMBIGUOUS',
                    columnNames: resolution.ambiguous,
                    message: diagnosticMessage(schemaAnalysis.error, unresolvedColumnNames, resolution.ambiguous),
                });
            }
            if (resolution.unresolved.length > 0) {
                diagnostics.push({
                    code: 'COLUMN_REFERENCE_UNRESOLVED',
                    columnNames: resolution.unresolved,
                    message: diagnosticMessage(schemaAnalysis.error, unresolvedColumnNames, resolution.unresolved),
                });
            }
        } else if (schemaAnalysis.error) {
            diagnostics.push({
                code: 'COLUMN_REFERENCE_UNRESOLVED',
                message: schemaAnalysis.error,
            });
        }

        for (const tableSchema of tableSchemas) {
            const resolvedColumns = resolver(tableSchema.name);
            if (resolvedColumns.length === 0) {
                diagnostics.push({
                    code: 'TABLE_NOT_DEFINED',
                    message: `Table '${tableSchema.name}' is not defined.`,
                    tableName: tableSchema.name,
                });
                continue;
            }

            for (const columnName of tableSchema.columns.filter((column) =>
                !unresolvedColumnNames.includes(column) && !resolvedColumns.includes(column)
            )) {
                diagnostics.push({
                    code: 'COLUMN_NOT_DEFINED',
                    columnName,
                    message: `Table '${tableSchema.name}' contains undefined column: ${columnName}.`,
                    tableName: tableSchema.name,
                });
            }
        }

        return {
            diagnostics,
            valid: diagnostics.every((diagnostic) => diagnostic.code === 'COLUMN_REFERENCE_UNRESOLVED'),
        };
    }

    /**
     * Validates a SQL query structure against a provided TableColumnResolver or TableSchema array.
     * @param sql The SQL query structure to validate, can be a SQL string or a SqlComponent.
     * @param tableResolver The TableColumnResolver or TableSchema array to validate against.
     * @throws Error if the query contains undefined tables or columns.
     */
    public static validate(
        sql: string | SqlComponent,
        tableResolver: TableColumnResolver | TableSchema[]
    ): void {
        const result = this.analyze(sql, tableResolver);
        if (result.diagnostics.length > 0) {
            const messages = result.diagnostics.reduce<string[]>((accumulator, diagnostic) => {
                if (diagnostic.code === 'COLUMN_REFERENCE_AMBIGUOUS' || diagnostic.code === 'COLUMN_REFERENCE_UNRESOLVED') {
                    accumulator.push(diagnostic.message);
                    return accumulator;
                }
                if (diagnostic.code === 'TABLE_NOT_DEFINED') {
                    accumulator.push(diagnostic.message);
                    return accumulator;
                }
                const previous = accumulator[accumulator.length - 1];
                const prefix = `Table '${diagnostic.tableName}' contains undefined columns: `;
                if (previous?.startsWith(prefix)) {
                    accumulator[accumulator.length - 1] = `${previous.slice(0, -1)}, ${diagnostic.columnName}.`;
                } else {
                    accumulator.push(`${prefix}${diagnostic.columnName}.`);
                }
                return accumulator;
            }, []);
            throw new Error(messages.join('\n'));
        }
    }
}

function classifyUnqualifiedColumns(
    sqlComponent: SqlComponent,
    resolver: TableColumnResolver,
    columnNames: string[],
): { ambiguous: string[]; unresolved: string[] } {
    if (!(sqlComponent instanceof SimpleSelectQuery) || !sqlComponent.fromClause) {
        return { ambiguous: [], unresolved: columnNames };
    }

    if (new CTECollector().collect(sqlComponent).length > 0) {
        return { ambiguous: [], unresolved: columnNames };
    }

    if ((sqlComponent.fromClause.joins ?? []).some((join) =>
        join.condition instanceof JoinUsingClause || join.joinType.value.toLowerCase().includes('natural')
    )) {
        return { ambiguous: [], unresolved: columnNames };
    }

    const directSources = sqlComponent.fromClause.getSources().map((source) => source.datasource);
    if (!directSources.every((source): source is TableSource => source instanceof TableSource)) {
        return { ambiguous: [], unresolved: columnNames };
    }

    const allPhysicalSources = new TableSourceCollector(false, false).collect(sqlComponent);
    if (
        allPhysicalSources.length !== directSources.length
        || allPhysicalSources.some((source) => !directSources.includes(source))
    ) {
        return { ambiguous: [], unresolved: columnNames };
    }

    const sourceColumns = directSources.map((source) => resolver(source.getSourceName()));
    if (sourceColumns.some((columns) => columns.length === 0)) {
        return { ambiguous: [], unresolved: columnNames };
    }

    const ambiguous: string[] = [];
    const unresolved: string[] = [];
    for (const columnName of columnNames) {
        if (columnName === '*' || columnName.endsWith('.*')) {
            unresolved.push(columnName);
            continue;
        }
        const candidateCount = sourceColumns.filter((columns) => columns.includes(columnName)).length;
        if (candidateCount > 1) {
            ambiguous.push(columnName);
        } else if (candidateCount === 0) {
            unresolved.push(columnName);
        }
    }
    return { ambiguous, unresolved };
}

function diagnosticMessage(
    analysisError: string | undefined,
    allColumns: string[],
    diagnosticColumns: string[],
): string {
    if (analysisError && diagnosticColumns.length === allColumns.length) {
        return analysisError;
    }
    return `Column reference(s) without table name found in query: ${diagnosticColumns.join(', ')}`;
}
