/**
 * Type definition for a function that resolves column names from a table name.
 *
 * This is used to provide table structure information (column names) for physical tables
 * when expanding wildcard selectors (e.g., table.*) in SQL query analysis.
 *
 * @param tableName The name of the table to resolve columns for.
 * @returns An array of column names (strings) for the specified table.
 *
 * @example
 * ```typescript
 * const resolver: TableColumnResolver = (table) => table === 'users' ? ['id', 'email'] : [];
 * const collector = new SchemaCollector(resolver);
 * const schemas = collector.collect(SelectQueryParser.parse('SELECT * FROM users'));
 * ```
 * Related tests: packages/core/tests/transformers/SchemaCollector.test.ts
 */
export type TableColumnResolver = (tableName: string) => string[];

