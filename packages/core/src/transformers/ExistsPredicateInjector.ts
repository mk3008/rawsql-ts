import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import {
    ColumnReference,
    InlineQuery,
    SqlParameterValue,
    UnaryExpression,
    ValueComponent
} from "../models/ValueComponent";
import { CTEQuery, ReturningClause, SelectItem, SourceExpression, TableSource, FromClause } from "../models/Clause";
import { InsertQuery } from "../models/InsertQuery";
import { UpdateQuery } from "../models/UpdateQuery";
import { DeleteQuery } from "../models/DeleteQuery";
import { QueryBuilder } from "./QueryBuilder";
import { SelectableColumnCollector, DuplicateDetectionMode } from "./SelectableColumnCollector";
import { UpstreamSelectQueryFinder } from "./UpstreamSelectQueryFinder";
import { SqlFormatter } from "./SqlFormatter";
import { SelectQueryParser } from "../parsers/SelectQueryParser";

/**
 * Represents an EXISTS / NOT EXISTS instruction derived from filter metadata.
 */
export interface ExistsInstruction {
    mode: "exists" | "notExists";
    anchorColumns: string[];
    sql: string;
    params?: Record<string, SqlParameterValue>;
}

/**
 * Configuration that controls how EXISTS predicates are injected.
 */
export interface ExistsPredicateOptions {
    tableColumnResolver?: (tableName: string) => string[];
    strict?: boolean;
}

/**
 * Describes a correlated subquery that renders an EXISTS/NOT EXISTS predicate.
 */
export interface ExistsSubqueryDefinition {
    /** SQL that references the `$c#` placeholders for the anchor columns. */
    sql: string;
    /** Optional named parameters that the subquery requires. */
    params?: Record<string, SqlParameterValue>;
}

/**
 * Injects EXISTS/NOT EXISTS predicates into the provided SelectQuery.
 * Each instruction is evaluated independently so failures can be skipped
 * when `strict` is false.
 */
export function injectExistsPredicates(
    query: SelectQuery,
    instructions: ExistsInstruction[],
    options: ExistsPredicateOptions = {}
): SelectQuery {
    if (instructions.length === 0) {
        return query;
    }

    const simpleQuery = QueryBuilder.buildSimpleQuery(query);
    const resolver = new ColumnReferenceResolver(options.tableColumnResolver);
    const formatter = new SqlFormatter();
    const strictMode = !!options.strict;

    for (const instruction of instructions) {
        try {
            applyInstruction(simpleQuery, instruction, resolver, formatter);
        } catch (error) {
            if (strictMode) {
                throw error;
            }
        }
    }

    return simpleQuery;
}

function applyInstruction(
    query: SimpleSelectQuery,
    instruction: ExistsInstruction,
    resolver: ColumnReferenceResolver,
    formatter: SqlFormatter
): void {
    if (instruction.anchorColumns.length === 0) {
        throw new Error("EXISTS instruction requires at least one anchor column.");
    }

    const resolvedColumns = instruction.anchorColumns.map(column => {
        const columnRef = resolver.resolve(query, column);
        if (!columnRef) {
            throw new Error(`Unable to resolve anchor column '${column}'.`);
        }
        return columnRef;
    });

    const formattedColumns = resolvedColumns.map(component => formatter.format(component).formattedSql);
    const placeholderSql = substitutePlaceholders(instruction.sql, formattedColumns);
    const normalizedSql = placeholderSql.trim();
    enforceSqlConstraints(normalizedSql);

    const subquery = SelectQueryParser.parse(normalizedSql);
    if (instruction.params) {
        bindSubqueryParameters(subquery, instruction.params);
    }

    const existsExpression = new UnaryExpression("exists", new InlineQuery(subquery));
    const predicate = instruction.mode === "exists"
        ? existsExpression
        : new UnaryExpression("not", existsExpression);

    query.appendWhere(predicate);
}

function substitutePlaceholders(sql: string, formattedColumns: string[]): string {
    const usedIndexes = new Set<number>();
    const replaced = sql.replace(/\$c(\d+)/g, (_, indexDigits) => {
        const index = Number(indexDigits);
        if (!Number.isInteger(index)) {
            throw new Error(`Invalid placeholder '$c${indexDigits}' in EXISTS SQL.`);
        }
        if (index < 0 || index >= formattedColumns.length) {
            throw new Error(`Placeholder '$c${index}' references a missing anchor column.`);
        }
        usedIndexes.add(index);
        return formattedColumns[index];
    });

    for (let i = 0; i < formattedColumns.length; i++) {
        if (!usedIndexes.has(i)) {
            throw new Error(`Missing placeholder '$c${i}' for anchor column.`);
        }
    }

    return replaced;
}

function enforceSqlConstraints(sql: string): void {
    if (!sql) {
        throw new Error("EXISTS SQL must not be empty.");
    }
    if (sql.includes(";")) {
        throw new Error("EXISTS SQL must not contain semicolons or multiple statements.");
    }
    if (/\blateral\b/i.test(sql)) {
        throw new Error("LATERAL is not supported in column-anchored EXISTS filters.");
    }
}

function bindSubqueryParameters(query: SelectQuery, params: Record<string, SqlParameterValue>): void {
    for (const [name, value] of Object.entries(params)) {
        query.setParameter(name, value);
    }
}

class ColumnReferenceResolver {
    private finder: UpstreamSelectQueryFinder;
    private collector: SelectableColumnCollector;

    constructor(private tableColumnResolver?: (tableName: string) => string[]) {
        this.finder = new UpstreamSelectQueryFinder(this.tableColumnResolver);
        this.collector = new SelectableColumnCollector(
            this.tableColumnResolver,
            false,
            DuplicateDetectionMode.FullName,
            { upstream: true }
        );
    }

    public resolve(query: SelectQuery, columnName: string): ValueComponent | null {
        const parsed = this.parseQualifiedColumnName(columnName);
        const searchColumn = parsed?.column ?? columnName;
        const targetTable = parsed?.table;

        const candidateQueries = this.finder.find(query, searchColumn);
        for (const candidate of candidateQueries) {
            const columns = this.collectColumns(candidate);
            const match = this.findMatchingColumn(columns, searchColumn, targetTable, candidate);
            if (match) {
                return match.value;
            }
        }

        return null;
    }

    private collectColumns(query: SimpleSelectQuery): { name: string; value: ValueComponent }[] {
        const columnEntries = this.collector.collect(query);
        const cteColumns = this.collectCTEColumns(query);
        return [...columnEntries, ...cteColumns];
    }

    private findMatchingColumn(
        columns: { name: string; value: ValueComponent }[],
        searchColumn: string,
        targetTable: string | undefined,
        query: SimpleSelectQuery
    ): { name: string; value: ValueComponent } | null {
        const normalizedSearch = this.normalizeColumnName(searchColumn);

        for (const entry of columns) {
            const normalizedEntry = this.normalizeColumnName(entry.name);
            if (normalizedEntry !== normalizedSearch) continue;

            if (targetTable) {
                if (this.matchesTable(entry.value, targetTable, query)) {
                    return entry;
                }
                continue;
            }

            return entry;
        }

        return null;
    }

    private matchesTable(value: ValueComponent, targetTable: string, query: SimpleSelectQuery): boolean {
        if (!(value instanceof ColumnReference)) {
            return false;
        }

        const namespace = value.getNamespace();
        if (!namespace) {
            return false;
        }

        const normalizedTarget = this.normalizeString(targetTable);
        const mapping = this.buildTableMapping(query);
        const aliasKey = namespace.toLowerCase();
        const mappedRealTable = mapping.aliasToRealTable.get(aliasKey);

        if (mappedRealTable && this.normalizeString(mappedRealTable) === normalizedTarget) {
            return true;
        }

        if (this.normalizeString(namespace) === normalizedTarget) {
            return true;
        }

        const aliasFromTarget = mapping.realTableToAlias.get(normalizedTarget);
        if (aliasFromTarget && aliasFromTarget.toLowerCase() === aliasKey) {
            return true;
        }

        return false;
    }

    private collectCTEColumns(query: SimpleSelectQuery): { name: string; value: ValueComponent }[] {
        const results: { name: string; value: ValueComponent }[] = [];

        if (!query.withClause) {
            return results;
        }

        for (const cte of query.withClause.tables) {
            try {
                const nestedColumns = this.collectColumnsFromCteQuery(cte.query);
                results.push(...nestedColumns);
            } catch {
                // Skip problematic CTEs to keep resolution best-effort.
            }
        }

        return results;
    }

    private collectColumnsFromCteQuery(query: CTEQuery): { name: string; value: ValueComponent }[] {
        if (!this.isSelectQuery(query)) {
            return this.collectColumnsFromReturning(query);
        }
        return this.collectColumnsFromSelectQuery(query);
    }

    private collectColumnsFromSelectQuery(query: SelectQuery): { name: string; value: ValueComponent }[] {
        if (query instanceof SimpleSelectQuery) {
            return this.collector.collect(query);
        }
        if (query instanceof BinarySelectQuery) {
            return this.collectColumnsFromSelectQuery(query.left);
        }
        return [];
    }

    private collectColumnsFromReturning(query: CTEQuery): { name: string; value: ValueComponent }[] {
        if (query instanceof InsertQuery || query instanceof UpdateQuery || query instanceof DeleteQuery) {
            return this.extractReturningColumns(query.returningClause);
        }
        return [];
    }

    private extractReturningColumns(returningClause: ReturningClause | null): { name: string; value: ValueComponent }[] {
        if (!returningClause) {
            return [];
        }

        const columns: { name: string; value: ValueComponent }[] = [];
        for (const item of returningClause.items) {
            const columnName = item.identifier?.name ?? this.extractColumnName(item);
            if (columnName) {
                columns.push({ name: columnName, value: item.value });
            }
        }
        return columns;
    }

    private extractColumnName(item: SelectItem): string | null {
        if (item.identifier) {
            return item.identifier.name;
        }
        if (item.value instanceof ColumnReference) {
            return item.value.column.name;
        }
        return null;
    }

    private buildTableMapping(query: SimpleSelectQuery): {
        aliasToRealTable: Map<string, string>;
        realTableToAlias: Map<string, string>;
    } {
        const aliasToRealMap = new Map<string, string>();
        const realToAliasMap = new Map<string, string>();

        const collectFromClause = (fromClause?: FromClause | null) => {
            if (!fromClause) return;

            this.processSourceForMapping(fromClause.source, aliasToRealMap, realToAliasMap);
            if (fromClause.joins) {
                for (const join of fromClause.joins) {
                    this.processSourceForMapping(join.source, aliasToRealMap, realToAliasMap);
                }
            }
        };

        collectFromClause(query.fromClause ?? undefined);

        if (query.withClause) {
            for (const cte of query.withClause.tables) {
                const alias = cte.getSourceAliasName()?.toLowerCase();
                if (alias) {
                    aliasToRealMap.set(alias, alias);
                    realToAliasMap.set(alias, alias);
                }
            }
        }

        return {
            aliasToRealTable: aliasToRealMap,
            realTableToAlias: realToAliasMap
        };
    }

    private processSourceForMapping(
        source: SourceExpression,
        aliasToReal: Map<string, string>,
        realToAlias: Map<string, string>
    ): void {
        try {
            if (source.datasource instanceof TableSource) {
                const realName = source.datasource.getSourceName();
                const aliasName = source.aliasExpression?.table?.name || realName;
                if (realName && aliasName) {
                    aliasToReal.set(aliasName.toLowerCase(), realName);
                    realToAlias.set(realName.toLowerCase(), aliasName);
                    if (aliasName.toLowerCase() === realName.toLowerCase()) {
                        aliasToReal.set(realName.toLowerCase(), realName);
                    }
                }
            }
        } catch {
            // Ignore mapping issues while continuing best-effort column resolution.
        }
    }

    private parseQualifiedColumnName(columnName: string): { table: string; column: string } | null {
        const parts = columnName.split(".");
        if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
            return {
                table: parts[0].trim(),
                column: parts[1].trim()
            };
        }
        return null;
    }

    private normalizeColumnName(name: string): string {
        const columnPart = name.includes(".") ? name.split(".").pop() ?? name : name;
        return this.normalizeString(columnPart);
    }

    private normalizeString(value: string): string {
        return value.toLowerCase();
    }

    private isSelectQuery(query: CTEQuery): query is SelectQuery {
        return "__selectQueryType" in query && (query as SelectQuery).__selectQueryType === "SelectQuery";
    }
}
