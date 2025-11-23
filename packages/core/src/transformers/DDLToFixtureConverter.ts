import { MultiQuerySplitter } from '../utils/MultiQuerySplitter';
import { SqlParser } from '../parsers/SqlParser';
import { CreateTableQuery } from '../models/CreateTableQuery';
import { InsertQuery } from '../models/InsertQuery';
import { ValuesQuery } from '../models/ValuesQuery';
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
        const insertQueries: InsertQuery[] = [];

        for (const query of splitResult.queries) {
            if (query.isEmpty) continue;
            try {
                const ast = SqlParser.parse(query.sql);
                if (ast instanceof CreateTableQuery) {
                    createTableQueries.push(ast);
                } else if (ast instanceof InsertQuery) {
                    insertQueries.push(ast);
                }
            } catch (e) {
                // Ignore parse errors for non-DDL or invalid SQL
            }
        }

        const registry = createTableDefinitionRegistryFromCreateTableQueries(createTableQueries);
        const fixtureJson: Record<string, any> = {};

        // Initialize fixtureJson with empty rows
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

        // Sequence counters for nextval defaults: table -> column -> counter
        const sequences: Record<string, Record<string, number>> = {};

        // Process INSERT statements
        for (const insert of insertQueries) {
            // Only support INSERT ... VALUES
            if (!(insert.selectQuery instanceof ValuesQuery)) {
                continue;
            }

            const tableName = insert.insertClause.source.getAliasName();
            if (!tableName || !fixtureJson[tableName]) {
                // Ignore INSERTs for unknown tables
                continue;
            }

            const tableDef = registry[tableName];
            const targetColumns = insert.insertClause.columns;
            const valuesQuery = insert.selectQuery as ValuesQuery;

            // If columns are not specified, use all columns in order
            const columnNames = targetColumns
                ? targetColumns.map(c => c.name)
                : tableDef.columns.map(c => c.name);

            for (const tuple of valuesQuery.tuples) {
                const row: Record<string, any> = {};

                // Map provided values
                for (let i = 0; i < columnNames.length; i++) {
                    const colName = columnNames[i];
                    if (i < tuple.values.length) {
                        const val = tuple.values[i];
                        row[colName] = this.extractValue(val);
                    }
                }

                // Fill missing columns with defaults
                for (const colDef of tableDef.columns) {
                    if (row[colDef.name] !== undefined) {
                        continue;
                    }

                    // Check for NOT NULL constraint without default
                    // TableColumnDefinitionModel.required is true if NOT NULL and no default/identity
                    if (colDef.required) {
                        throw new Error(`Column '${colDef.name}' in table '${tableName}' cannot be null and has no default value.`);
                    }

                    const hasDefault = colDef.defaultValue !== null && colDef.defaultValue !== undefined;

                    if (hasDefault) {
                        const defaultValStr = this.formatDefaultValue(colDef.defaultValue);
                        if (defaultValStr) {
                            const trimmedDefault = defaultValStr.trim();
                            const lowerTrimmed = trimmedDefault.toLowerCase();
                            const stringLiteralValue =
                                trimmedDefault.startsWith("'") && trimmedDefault.endsWith("'")
                                    ? trimmedDefault.slice(1, -1).replace(/''/g, "'")
                                    : trimmedDefault;

                            // Normalize literal NULLs (even when quoted) into JS null
                            if (stringLiteralValue.toLowerCase() === 'null') {
                                row[colDef.name] = null;
                            } else if (lowerTrimmed.includes('nextval')) {
                                // Handle nextval sequence
                                if (!sequences[tableName]) sequences[tableName] = {};
                                if (!sequences[tableName][colDef.name]) sequences[tableName][colDef.name] = 0;
                                sequences[tableName][colDef.name]++;
                                row[colDef.name] = sequences[tableName][colDef.name];
                            } else if (lowerTrimmed.includes('now') || lowerTrimmed.includes('current_timestamp')) {
                                // Handle timestamp defaults - use a fixed date for consistency or current date
                                // Using a fixed date makes tests deterministic
                                row[colDef.name] = "2023-01-01 00:00:00";
                            } else {
                                // Use the literal default value
                                // Try to unquote if it's a string literal
                                if (trimmedDefault.startsWith("'") && trimmedDefault.endsWith("'")) {
                                    row[colDef.name] = stringLiteralValue;
                                } else {
                                    // Try to parse number/boolean/null
                                    const num = Number(trimmedDefault);
                                    if (!isNaN(num)) {
                                        row[colDef.name] = num;
                                    } else {
                                        const lower = trimmedDefault.toLowerCase();
                                        if (lower === 'true') {
                                            row[colDef.name] = true;
                                        } else if (lower === 'false') {
                                            row[colDef.name] = false;
                                        } else if (lower === 'null') {
                                            row[colDef.name] = null;
                                        } else {
                                            row[colDef.name] = trimmedDefault;
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // Default to null
                        row[colDef.name] = null;
                    }
                }

                fixtureJson[tableName].rows.push(row);
            }
        }

        return fixtureJson;
    }

    private static extractValue(value: ValueComponent): any {
        if (value instanceof LiteralValue) {
            return value.value;
        }
        // For other types, try to format to string
        try {
            const formatter = new SqlFormatter({ keywordCase: 'none' });
            const { formattedSql } = formatter.format(value);
            // Remove quotes if it looks like a string literal
            if (formattedSql.startsWith("'") && formattedSql.endsWith("'")) {
                return formattedSql.slice(1, -1).replace(/''/g, "'");
            }
            return formattedSql;
        } catch (e) {
            return String(value);
        }
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
