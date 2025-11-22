import { MultiQuerySplitter } from '../utils/MultiQuerySplitter';
import { SqlParser } from '../parsers/SqlParser';
import { CreateTableQuery } from '../models/CreateTableQuery';
import { createTableDefinitionRegistryFromCreateTableQueries } from '../models/TableDefinitionModel';
import { ValueComponent, LiteralValue } from '../models/ValueComponent';
import { SqlFormatter } from './SqlFormatter';

export class DDLToFixtureConverter {
    /**
     * Converts DDL statements (CREATE TABLE) in the provided SQL text to a Fixture JSON object.
     * Ignores non-DDL statements and parse errors.
     * 
     * @param ddlSql The SQL text containing CREATE TABLE statements.
     * @returns A Record representing the Fixture JSON.
     */
    public static convert(ddlSql: string): Record<string, any> {
        const splitResult = MultiQuerySplitter.split(ddlSql);
        const createTableQueries: CreateTableQuery[] = [];

        for (const query of splitResult.queries) {
            if (query.isEmpty) continue;
            try {
                const ast = SqlParser.parse(query.sql);
                if (ast instanceof CreateTableQuery) {
                    createTableQueries.push(ast);
                }
            } catch (e) {
                // Ignore parse errors for non-DDL or invalid SQL
            }
        }

        const registry = createTableDefinitionRegistryFromCreateTableQueries(createTableQueries);
        const fixtureJson: Record<string, any> = {};

        for (const [tableName, def] of Object.entries(registry)) {
            fixtureJson[tableName] = {
                columns: def.columns.map(col => ({
                    name: col.name,
                    type: col.typeName,
                    default: this.formatDefaultValue(col.defaultValue)
                })),
                rows: []
            };
        }

        return fixtureJson;
    }

    private static formatDefaultValue(value: string | ValueComponent | null | undefined): string | undefined {
        if (value === null || value === undefined) {
            return undefined;
        }
        if (typeof value === 'string') {
            return value;
        }

        try {
            // Use SqlFormatter to print the AST node
            const formatter = new SqlFormatter({ keywordCase: 'none' });
            const { formattedSql } = formatter.format(value);
            return formattedSql;
        } catch (e) {
            // Fallback if formatter fails
            return String(value);
        }
    }
}
