import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SchemaCollector } from '../../src/transformers/SchemaCollector';
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
});
