import { CommonTable, WithClause } from "../models/Clause";
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { CTECollector } from "./CTECollector";
import { CTEBuilder } from "./CTEBuilder";
import { TableSchema } from "./SchemaCollector";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { SchemaCollector } from "./SchemaCollector";

/**
 * Represents a collection of fixtures (test data) to be injected into a SQL query.
 * Each key is a table name, and the value is an array of objects representing rows.
 */
export type Fixtures = Record<string, Array<Record<string, unknown>>>;

/**
 * CTEInjector accepts a SelectQuery object and an array of CommonTables,
 * and inserts Common Table Expressions into the query.
 * For BinarySelectQuery, CTEs are inserted into the left query.
 * 
 * Uses CTENameConflictResolver to resolve naming conflicts between CTEs.
 */
export class CTEInjector {
    private nameConflictResolver: CTEBuilder;
    private cteCollector: CTECollector;

    constructor() {
        this.nameConflictResolver = new CTEBuilder();
        this.cteCollector = new CTECollector();
    }

    /**
     * Inserts Common Table Expressions into a SelectQuery object.
     * 
     * @param query The query to inject CTEs into
     * @param commonTables Array of CommonTables to be inserted
     * @returns A new query with the injected CTEs
     */
    public inject(query: SelectQuery, commonTables: CommonTable[]): SelectQuery {
        // If the array is empty, return the query as is
        if (commonTables.length === 0) {
            return query;
        }

        // Collect CTEs from the query
        commonTables.push(...this.cteCollector.collect(query));

        // Use CTENameConflictResolver to resolve duplicates and sort in appropriate order
        const resolvedWithCaluse = this.nameConflictResolver.build(commonTables);

        // Process based on query type
        if (query instanceof SimpleSelectQuery) {
            return this.injectIntoSimpleQuery(query, resolvedWithCaluse);
        } else if (query instanceof BinarySelectQuery) {
            return this.injectIntoBinaryQuery(query, resolvedWithCaluse);
        }

        // Unsupported query type
        throw new Error("Unsupported query type");
    }

    /**
     * Injects fixture-based Common Table Expressions into a SQL query.
     * This allows testing queries with deterministic test data.
     * 
     * @param sql The SQL query to inject fixtures into
     * @param deps Schema information collected from the query
     * @param fixtures Test data to be injected as CTEs
     * @param options Options for CTE injection
     * @returns A SQL string with injected fixture CTEs
     */
    public withFixtures(
        sql: string, 
        deps: TableSchema[], 
        fixtures: Fixtures,
        options: { quoteIdentifiers?: boolean } = {}
    ): string {
        // If no fixtures provided, return the original SQL
        if (!fixtures || Object.keys(fixtures).length === 0) {
            return sql;
        }

        const quoteIdentifiers = options.quoteIdentifiers ?? false;
        const cteStatements: string[] = [];

        // For each table in the schema that has fixtures
        for (const schema of deps) {
            const tableName = schema.name;
            const fixtureData = fixtures[tableName];

            // Skip if no fixture data for this table
            if (!fixtureData || fixtureData.length === 0) {
                continue;
            }

            // Get column names from the schema
            const columns = schema.columns;
            if (columns.length === 0) {
                continue;
            }

            // Build the CTE header with table and column names
            const quotedTableName = this.quoteIdentifier(tableName, quoteIdentifiers);
            const quotedColumns = columns.map(col => this.quoteIdentifier(col, quoteIdentifiers));
            let cte = `${quotedTableName}(${quotedColumns.join(', ')}) AS (\n  VALUES\n`;

            // Process each row in the fixture data
            const valueRows: string[] = fixtureData.map(row => {
                const rowValues = columns.map(col => {
                    const value = col in row ? row[col] : null;
                    return this.formatValue(value);
                });
                return `    (${rowValues.join(', ')})`;
            });

            cte += valueRows.join(',\n');
            cte += '\n)';
            cteStatements.push(cte);
        }

        // If no CTEs were generated, return the original SQL
        if (cteStatements.length === 0) {
            return sql;
        }

        // Combine the CTE statements with the original query
        return `WITH\n${cteStatements.join(',\n')}\n${sql}`;
    }

    /**
     * Injects NULL-based scaffolding Common Table Expressions into a SQL query.
     * This version creates CTEs with NULL values for all columns.
     * 
     * @param sql The SQL query to inject NULL scaffolding into
     * @param deps Schema information collected from the query
     * @param options Options for CTE injection
     * @returns A SQL string with injected scaffolding CTEs
     */
    public withNullScaffolding(
        sql: string, 
        deps: TableSchema[], 
        options: { quoteIdentifiers?: boolean } = {}
    ): string {
        // Create empty fixtures with one NULL row per table
        const nullFixtures: Fixtures = {};
        
        for (const schema of deps) {
            const emptyRow: Record<string, unknown> = {};
            // Initialize all columns to NULL
            for (const col of schema.columns) {
                emptyRow[col] = null;
            }
            nullFixtures[schema.name] = [emptyRow];
        }

        // Use the withFixtures method with our NULL fixtures
        return this.withFixtures(sql, deps, nullFixtures, options);
    }

    /**
     * Formats a value as a SQL literal based on its JavaScript type.
     * 
     * @param value The value to format
     * @returns A SQL-formatted string representation of the value
     */
    private formatValue(value: unknown): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }

        // Handle different types
        switch (typeof value) {
            case 'string':
                // Escape single quotes by doubling them
                return `'${(value as string).replace(/'/g, "''")}'`;
            case 'number':
                return value.toString();
            case 'boolean':
                return value ? 'TRUE' : 'FALSE';
            case 'object':
                if (value instanceof Date) {
                    return `'${value.toISOString()}'`;
                }
                // For other objects, convert to JSON string
                return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
            default:
                return 'NULL';
        }
    }

    /**
     * Quotes an identifier if the quoteIdentifiers option is enabled.
     * 
     * @param identifier The identifier to quote
     * @param quoteIdentifiers Whether to quote identifiers
     * @returns The quoted or unquoted identifier
     */
    private quoteIdentifier(identifier: string, quoteIdentifiers: boolean): string {
        return quoteIdentifiers ? `"${identifier}"` : identifier;
    }

    /**
     * Inserts Common Table Expressions into a SimpleSelectQuery.
     * 
     * @param query The SimpleSelectQuery to inject CTEs into
     * @param commonTables Array of CommonTables to be inserted
     * @param needRecursive Boolean indicating if recursive WITH clause is needed
     * @returns A new SimpleSelectQuery with the injected CTEs
     */
    private injectIntoSimpleQuery(query: SimpleSelectQuery, withClause: WithClause): SimpleSelectQuery {
        if (query.withClause) {
            throw new Error("The query already has a WITH clause. Please remove it before injecting new CTEs.");
        }
        // If the query doesn't have a WITH clause, set the new one
        query.withClause = withClause;
        return query;
    }

    /**
     * Inserts Common Table Expressions into the left query of a BinarySelectQuery.
     * 
     * @param query The BinarySelectQuery to inject CTEs into
     * @param commonTables Array of CommonTables to be inserted
     * @param needRecursive Boolean indicating if recursive WITH clause is needed
     * @returns A new BinarySelectQuery with the injected CTEs
     */
    private injectIntoBinaryQuery(query: BinarySelectQuery, withClause: WithClause): BinarySelectQuery {
        // Insert CTEs into the left query
        if (query.left instanceof SimpleSelectQuery) {
            this.injectIntoSimpleQuery(query.left, withClause);
            return query;
        } else if (query.left instanceof BinarySelectQuery) {
            this.injectIntoBinaryQuery(query.left, withClause);
            return query;
        }
        throw new Error("Unsupported query type for BinarySelectQuery left side");
    }
}
