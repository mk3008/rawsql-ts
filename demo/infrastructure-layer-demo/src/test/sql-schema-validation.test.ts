import { describe, it, expect, beforeAll } from 'vitest';
import { SqlSchemaValidator } from 'rawsql-ts';
import { schemaManager } from '../infrastructure/schema-migrated';
import { SqlQueryLoader } from '../infrastructure/sql-loader';

describe('SQL Schema Validation', () => {
    let tableColumnResolver: any;
    let sqlLoader: SqlQueryLoader; beforeAll(async () => {
        // Initialize table column resolver from schema manager
        tableColumnResolver = schemaManager.createTableColumnResolver();

        // Initialize SQL loader and load all queries
        sqlLoader = new SqlQueryLoader();
        sqlLoader.loadAllQueries();
    });

    it('should validate all SQL queries against schema', () => {
        // Get all available SQL query names
        const queryNames = sqlLoader.getAvailableQueries();
        console.log('Available queries:', queryNames);
        console.log('Query names length:', queryNames.length);

        // Debug: check if sqlLoader is working
        try {
            const testQuery = sqlLoader.getQuery('findTodos');
            console.log('Test query findTodos:', testQuery);
        } catch (error) {
            console.log('Error getting findTodos:', error);
        }

        // Validate each SQL query
        for (const queryName of queryNames) {
            const sqlQuery = sqlLoader.getQuery(queryName);
            console.log(`Validating query: ${queryName}`);

            expect(() => {
                SqlSchemaValidator.validate(sqlQuery, tableColumnResolver);
            }).not.toThrow();
        }

        // Also verify we have some queries to test
        expect(queryNames.length).toBeGreaterThan(0);
    });
});
