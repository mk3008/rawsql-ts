import { SchemaCollector, TableSchema } from '../transformers/SchemaCollector';
import { SqlComponent } from '../models/SqlComponent';
import { TableColumnResolver } from '../transformers/TableColumnResolver';
import { SelectQueryParser } from '../parsers/SelectQueryParser';

export class SqlStaticAnalyzer {
    /**
     * Analyzes a SQL query structure and validates it against a provided TableColumnResolver.
     * @param sql The SQL query structure to analyze, can be a SQL string or a SqlComponent.
     * @param tableResolver The TableColumnResolver to validate against.
     * @throws Error if the query contains columns not defined in the TableColumnResolver.
     */
    public static analyze(
        sql: string | SqlComponent,
        tableResolver: TableColumnResolver | TableSchema[]
    ): void {
        const sqlComponent = typeof sql === 'string' ? SelectQueryParser.parse(sql) : sql;

        // Convert TableSchema[] to a resolver function if necessary
        const resolver = Array.isArray(tableResolver)
            ? (tableName: string) => {
                const schema = tableResolver.find((t) => t.name === tableName);
                return schema ? schema.columns : [];
            }
            : tableResolver;

        const schemaCollector = new SchemaCollector(resolver);
        const tableSchemas = schemaCollector.collect(sqlComponent);
        const errors: string[] = [];

        for (const tableSchema of tableSchemas) {
            const resolvedColumns = resolver(tableSchema.name);
            if (resolvedColumns.length === 0) {
                errors.push(`Table '${tableSchema.name}' is not defined.`);
                continue;
            }

            const undefinedColumns = tableSchema.columns.filter(column => !resolvedColumns.includes(column));
            if (undefinedColumns.length > 0) {
                errors.push(
                    `Table '${tableSchema.name}' contains undefined columns: ${undefinedColumns.join(', ')}.`
                );
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }
}
