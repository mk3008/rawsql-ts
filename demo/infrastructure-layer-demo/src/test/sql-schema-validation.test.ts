import { describe, it, expect, beforeAll } from 'vitest';
import { SqlSchemaValidator } from 'rawsql-ts';
import { schemaManager } from '../infrastructure/schema-definitions';
import { SqlQueryLoader } from '../infrastructure/sql-loader';

/**
 * What this test guarantees:
 * 1. SQL Parse Validation: All SQL files can be parsed correctly (valid syntax)
 * 2. Schema Consistency: All referenced tables/columns exist in the physical schema
 * 3. Static Analysis: Validates structure without database execution (fast & safe)
 * 4. Left-shift Testing: Catches SQL errors at build time, not runtime
 */
describe('SQL Schema Validation', () => {
    let tableColumnResolver: any;
    let sqlLoader: SqlQueryLoader;

    beforeAll(async () => {
        // Initialize table column resolver from schema manager
        tableColumnResolver = schemaManager.createTableColumnResolver();

        // Initialize SQL loader and load all queries
        sqlLoader = new SqlQueryLoader();
        sqlLoader.loadAllQueries();
    });

    it('should validate all SQL queries against schema', () => {
        // This test ensures:
        // - SQL syntax is valid (parseable)
        // - All table/column references exist in schema
        // - No typos in table/column names
        // - Structural integrity without database execution

        const queryNames = sqlLoader.getAvailableQueries();

        // Validate each SQL query against the schema
        for (const queryName of queryNames) {
            const sqlQuery = sqlLoader.getQuery(queryName);

            // Static validation: ensures SQL is structurally correct
            // without executing against a real database
            expect(() => {
                SqlSchemaValidator.validate(sqlQuery, tableColumnResolver);
            }).not.toThrow();
        }

        // Ensure we actually tested some queries
        expect(queryNames.length).toBeGreaterThan(0);
    });
});
