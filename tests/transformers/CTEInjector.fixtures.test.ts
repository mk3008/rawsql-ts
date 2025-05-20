import { describe, expect, test } from 'vitest';
import { CTEInjector, Fixtures } from '../../src/transformers/CTEInjector';
import { TableSchema } from '../../src/transformers/SchemaCollector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SchemaCollector } from '../../src/transformers/SchemaCollector';

describe('CTEInjector (Fixtures)', () => {
    test('withFixtures returns original SQL when fixtures are empty', () => {
        // Arrange
        const sql = 'SELECT * FROM users';
        const deps = [new TableSchema('users', ['id', 'name'])];
        const fixtures: Fixtures = {};
        const injector = new CTEInjector();

        // Act
        const result = injector.withFixtures(sql, deps, fixtures);

        // Assert
        expect(result).toBe(sql);
    });

    test('withFixtures injects simple fixture data correctly', () => {
        // Arrange
        const sql = 'SELECT name, age FROM users WHERE age > 21';
        const deps = [new TableSchema('users', ['id', 'name', 'age'])];
        const fixtures: Fixtures = {
            users: [
                { id: 1, name: 'Alice', age: 30 },
                { id: 2, name: 'Bob', age: 25 }
            ]
        };
        const injector = new CTEInjector();

        // Act
        const result = injector.withFixtures(sql, deps, fixtures);

        // Assert
        expect(result).toContain('WITH');
        expect(result).toContain('users(id, name, age) AS (');
        expect(result).toContain('VALUES');
        expect(result).toContain('(1, \'Alice\', 30)');
        expect(result).toContain('(2, \'Bob\', 25)');
        expect(result).toContain('SELECT name, age FROM users WHERE age > 21');
    });

    test('withFixtures handles NULL values correctly', () => {
        // Arrange
        const sql = 'SELECT name, email FROM users';
        const deps = [new TableSchema('users', ['id', 'name', 'email'])];
        const fixtures: Fixtures = {
            users: [
                { id: 1, name: 'Alice', email: null },
                { id: 2, name: 'Bob', email: 'bob@example.com' }
            ]
        };
        const injector = new CTEInjector();

        // Act
        const result = injector.withFixtures(sql, deps, fixtures);

        // Assert
        expect(result).toContain('(1, \'Alice\', NULL)');
        expect(result).toContain('(2, \'Bob\', \'bob@example.com\')');
    });

    test('withFixtures handles missing columns by filling with NULL', () => {
        // Arrange
        const sql = 'SELECT name, age FROM users';
        const deps = [new TableSchema('users', ['id', 'name', 'age', 'email'])];
        const fixtures: Fixtures = {
            users: [
                { id: 1, name: 'Alice' }, // age and email missing
                { id: 2, name: 'Bob', age: 25 } // email missing
            ]
        };
        const injector = new CTEInjector();

        // Act
        const result = injector.withFixtures(sql, deps, fixtures);

        // Assert
        expect(result).toContain('(1, \'Alice\', NULL, NULL)');
        expect(result).toContain('(2, \'Bob\', 25, NULL)');
    });

    test('withFixtures handles different value types correctly', () => {
        // Arrange
        const sql = 'SELECT * FROM data';
        const deps = [new TableSchema('data', ['id', 'name', 'active', 'created_at', 'score', 'metadata'])];
        const now = new Date('2023-01-01T12:00:00Z');
        const fixtures: Fixtures = {
            data: [
                { 
                    id: 1, 
                    name: 'Item 1', 
                    active: true, 
                    created_at: now,
                    score: 9.5,
                    metadata: { tags: ['test', 'sample'] }
                }
            ]
        };
        const injector = new CTEInjector();

        // Act
        const result = injector.withFixtures(sql, deps, fixtures);

        // Assert
        expect(result).toContain(`(1, 'Item 1', TRUE, '${now.toISOString()}', 9.5, '{\"tags\":[\"test\",\"sample\"]}')`);
    });

    test('withFixtures quotes identifiers when quoteIdentifiers is true', () => {
        // Arrange
        const sql = 'SELECT name FROM users';
        const deps = [new TableSchema('users', ['id', 'name'])];
        const fixtures: Fixtures = {
            users: [
                { id: 1, name: 'Alice' }
            ]
        };
        const injector = new CTEInjector();

        // Act
        const result = injector.withFixtures(sql, deps, fixtures, { quoteIdentifiers: true });

        // Assert
        expect(result).toContain('"users"("id", "name") AS (');
    });

    test('withFixtures handles multiple tables correctly', () => {
        // Arrange
        const sql = 'SELECT u.name, o.product FROM users u JOIN orders o ON u.id = o.user_id';
        const deps = [
            new TableSchema('users', ['id', 'name']),
            new TableSchema('orders', ['id', 'user_id', 'product'])
        ];
        const fixtures: Fixtures = {
            users: [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' }
            ],
            orders: [
                { id: 101, user_id: 1, product: 'Widget' },
                { id: 102, user_id: 1, product: 'Gadget' },
                { id: 103, user_id: 2, product: 'Thingamajig' }
            ]
        };
        const injector = new CTEInjector();

        // Act
        const result = injector.withFixtures(sql, deps, fixtures);

        // Assert
        expect(result).toContain('users(id, name) AS (');
        expect(result).toContain('orders(id, user_id, product) AS (');
        expect(result).toContain('(1, \'Alice\')');
        expect(result).toContain('(101, 1, \'Widget\')');
    });

    test('withFixtures properly escapes single quotes in string values', () => {
        // Arrange
        const sql = 'SELECT name FROM users';
        const deps = [new TableSchema('users', ['id', 'name'])];
        const fixtures: Fixtures = {
            users: [
                { id: 1, name: "O'Brien" },
                { id: 2, name: "User's data" }
            ]
        };
        const injector = new CTEInjector();

        // Act
        const result = injector.withFixtures(sql, deps, fixtures);

        // Assert
        expect(result).toContain('(1, \'O\'\'Brien\')');
        expect(result).toContain('(2, \'User\'\'s data\')');
    });

    test('withNullScaffolding creates CTEs with NULL values', () => {
        // Arrange
        const sql = 'SELECT u.name, o.product FROM users u JOIN orders o ON u.id = o.user_id';
        const deps = [
            new TableSchema('users', ['id', 'name']),
            new TableSchema('orders', ['id', 'user_id', 'product'])
        ];
        const injector = new CTEInjector();

        // Act
        const result = injector.withNullScaffolding(sql, deps);

        // Assert
        expect(result).toContain('users(id, name) AS (');
        expect(result).toContain('orders(id, user_id, product) AS (');
        expect(result).toContain('(NULL, NULL)');
        expect(result).toContain('(NULL, NULL, NULL)');
    });

    test('end-to-end test with a real SQL query and fixtures', () => {
        // Arrange
        const sql = `
            SELECT u.name, SUM(o.total) AS sum_total
            FROM users u
            JOIN orders o ON o.user_id = u.id
            GROUP BY u.name
        `;
        
        // Parse and collect schema
        const query = SelectQueryParser.parse(sql);
        const schemaCollector = new SchemaCollector();
        const deps = schemaCollector.collect(query);
        
        // Create fixtures
        const fixtures: Fixtures = {
            users: [
                { id: 1, name: 'mike' },
                { id: 2, name: 'ken' },
            ],
            orders: [
                { user_id: 1, total: 100 },
                { user_id: 1, total: 500 },
                { user_id: 2, total: 300 },
            ],
        };
        
        const injector = new CTEInjector();

        // Act
        const testSQL = injector.withFixtures(sql, deps, fixtures);

        // Assert
        expect(testSQL).toContain('WITH');
        expect(testSQL).toContain('users(id, name) AS (');
        expect(testSQL).toContain('orders(total, user_id) AS ('); // Note: SchemaCollector sorts columns alphabetically
        expect(testSQL).toContain('(1, \'mike\')');
        expect(testSQL).toContain('(100, 1)');
    });
});