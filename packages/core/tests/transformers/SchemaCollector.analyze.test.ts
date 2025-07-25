import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SchemaCollector } from '../../src/transformers/SchemaCollector';

describe('SchemaCollector.analyze', () => {
    test('should successfully analyze simple SELECT query', () => {
        // Arrange
        const sql = `SELECT u.id, u.name FROM users as u`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(true);
        expect(result.schemas.length).toBe(1);
        expect(result.schemas[0].name).toBe('users');
        expect(result.schemas[0].columns).toEqual(['id', 'name']);
        expect(result.unresolvedColumns).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    test('should detect unresolved columns in JOIN queries', () => {
        // Arrange
        const sql = `SELECT id, name FROM users u JOIN orders o ON u.id = o.user_id`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(false);
        expect(result.unresolvedColumns).toEqual(['id', 'name']);
        expect(result.error).toBe('Column reference(s) without table name found in query: id, name');
        expect(result.schemas.length).toBe(2); // Still collects table info
    });

    test('should handle wildcard without resolver', () => {
        // Arrange
        const sql = `SELECT * FROM users`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector(); // No resolver, default option

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(false);
        expect(result.unresolvedColumns).toEqual(['*']);
        expect(result.error).toBe('Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards. Target table: users');
        expect(result.schemas.length).toBe(1); // Still collects table info
    });

    test('should handle qualified wildcard without resolver', () => {
        // Arrange
        const sql = `SELECT u.* FROM users as u`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector(null, false); // Explicitly false

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(false);
        expect(result.unresolvedColumns).toEqual(['u.*']);
        expect(result.error).toBe('Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards. Target table: users');
    });

    test('should handle multiple unresolved columns from different tables', () => {
        // Arrange
        const sql = `SELECT id, name, order_id FROM users u JOIN orders o ON u.id = o.user_id`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(false);
        expect(result.unresolvedColumns).toEqual(['id', 'name', 'order_id']);
        expect(result.error).toBe('Column reference(s) without table name found in query: id, name, order_id');
    });

    test('should successfully analyze query with proper table prefixes', () => {
        // Arrange
        const sql = `SELECT u.id, u.name, o.order_id FROM users u JOIN orders o ON u.id = o.user_id`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(true);
        expect(result.schemas.length).toBe(2);
        expect(result.unresolvedColumns).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    test('should handle wildcards with allowWildcardWithoutResolver option', () => {
        // Arrange
        const sql = `SELECT * FROM users`;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector(null, true); // allowWildcardWithoutResolver = true

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(true); // Should succeed with the option enabled
        expect(result.schemas.length).toBe(1);
        expect(result.schemas[0].name).toBe('users');
        expect(result.schemas[0].columns).toEqual([]); // Wildcards are excluded when no resolver
        expect(result.unresolvedColumns).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    test('should handle UNION queries', () => {
        // Arrange
        const sql = `
            SELECT u.id, u.name FROM users as u
            UNION
            SELECT c.id, c.email FROM customers c
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(true);
        expect(result.schemas.length).toBe(2);
        expect(result.unresolvedColumns).toEqual([]);
        expect(result.error).toBeUndefined();
    });
});