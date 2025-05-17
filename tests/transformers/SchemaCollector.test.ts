import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SchemaCollector } from '../../src/transformers/SchemaCollector';
import { TableColumnResolver } from '../../src/transformers/TableColumnResolver';

// Test cases for SchemaCollector

describe('SchemaCollector', () => {
    test('collects schema information from simple SELECT query', () => {
        // Arrange
        const sql = `SELECT u.id, u.name FROM users as u`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
    });

    test('collects schema information from query with JOIN clause', () => {
        // Arrange
        const sql = `SELECT u.id, u.name, o.order_id FROM users u JOIN orders o ON u.id = o.user_id`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(2);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
        expect(schemaInfo[1].name).toBe('orders');
        expect(schemaInfo[1].columns).toEqual(['order_id', 'user_id']);
    });

    test('collects schema information from UNION query', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name FROM users as u
            UNION
            SELECT customers.id, customers.email FROM customers
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(2);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
        expect(schemaInfo[1].name).toBe('customers');
        expect(schemaInfo[1].columns).toEqual(['id', 'email']);
    });

    test('merges schema information for the same table referenced multiple times in UNION query', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name FROM users as u
            UNION
            SELECT u.id, u.email FROM users as u
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name', 'email']);
    });

    test('collects schema information from three UNION queries', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name FROM users as u
            UNION
            SELECT u.id, u.email FROM users as u
            UNION
            SELECT u.id, u.address FROM users as u
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name', 'email', 'address']);
    });

    test('collects schema information from CTE used in FROM clause', () => {
        // Arrange
        const sql = `
            WITH cte_users AS (
                SELECT id, name FROM users
            )
            SELECT cte_users.id, cte_users.name FROM cte_users
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
    });

    test('handles queries with omitted table names for columns when there is only one table', () => {
        // Arrange
        const sql = `
            SELECT id, name FROM users
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
    });

    test('collects schema information from CTE used in JOIN clause', () => {
        // Arrange
        const sql = `
            WITH cte_orders AS (
                SELECT order_id, user_id FROM orders
            )
            SELECT u.id, u.name, cte_orders.order_id FROM users u
            JOIN cte_orders ON u.id = cte_orders.user_id
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(2);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
        expect(schemaInfo[1].name).toBe('orders');
        expect(schemaInfo[1].columns).toEqual(['order_id', 'user_id']);
    });

    test('collects schema information from subquery in FROM clause', () => {
        // Arrange
        const sql = `
            SELECT sq.id, sq.name FROM (
                SELECT id, name FROM users
            ) AS sq
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
    });

    test('collects schema information from subquery in JOIN clause', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name, sq.total FROM users u
            JOIN (
                SELECT user_id, SUM(amount) as total FROM orders GROUP BY user_id
            ) AS sq ON u.id = sq.user_id
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(2);
        expect(schemaInfo[0].name).toBe('users');
        expect(schemaInfo[0].columns).toEqual(['id', 'name']);
        expect(schemaInfo[1].name).toBe('orders');
        expect(schemaInfo[1].columns).toEqual(['user_id', 'amount']);
    });
});

describe('SchemaCollector with TableColumnResolver', () => {
    test('resolves wildcard columns using TableColumnResolver', () => {
        // Arrange
        const sql = `SELECT * FROM users`;
        const query = SelectQueryParser.parse(sql);
        const mockResolver: TableColumnResolver = (tableName) => {
            if (tableName === 'users') {
                return ['id', 'name', 'email'];
            }
            return [];
        };
        const collector = new SchemaCollector(mockResolver);

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(new Set(schemaInfo[0].columns)).toStrictEqual(new Set(['id', 'name', 'email']));
    });

    test('resolves wildcard columns with alias using TableColumnResolver', () => {
        // Arrange
        const sql = `SELECT u.* FROM users as u`;
        const query = SelectQueryParser.parse(sql);
        const mockResolver: TableColumnResolver = (tableName) => {
            if (tableName === 'users') {
                return ['id', 'name', 'email'];
            }
            return [];
        };
        const collector = new SchemaCollector(mockResolver);

        // Act
        const schemaInfo = collector.collect(query);

        // Assert
        expect(schemaInfo.length).toBe(1);
        expect(schemaInfo[0].name).toBe('users');
        expect(new Set(schemaInfo[0].columns)).toStrictEqual(new Set(['id', 'name', 'email']));
    });
});
