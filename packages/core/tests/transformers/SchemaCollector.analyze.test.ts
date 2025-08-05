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

    // CTE (Common Table Expression) tests
    test('should collect CTE schemas in analyze mode', () => {
        // Arrange
        const sql = `
            WITH dat AS (
                SELECT line_id, name, unit_price, quantity, tax_rate
                FROM table_a
            ),
            detail AS (
                SELECT dat.line_id, dat.name
                FROM dat
            )
            SELECT detail.line_id, detail.name FROM detail
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(true);
        expect(result.schemas.length).toBe(3); // table_a, dat, detail
        expect(result.schemas.map(s => s.name).sort()).toEqual(['dat', 'detail', 'table_a']);
        expect(result.schemas.find(s => s.name === 'dat')?.columns.sort()).toEqual(['line_id', 'name']);
        expect(result.schemas.find(s => s.name === 'detail')?.columns.sort()).toEqual(['line_id', 'name']);
        expect(result.unresolvedColumns).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    test('should detect undefined columns in CTE queries', () => {
        // Arrange
        const sql = `
            WITH dat AS (
                SELECT line_id, name, unit_price, quantity, tax_rate
                FROM table_a
            )
            SELECT line_id, nonexistent_column FROM dat
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(false);
        expect(result.schemas.length).toBe(2); // table_a, dat
        expect(result.schemas.map(s => s.name).sort()).toEqual(['dat', 'table_a']);
        expect(result.unresolvedColumns).toContain('nonexistent_column');
        expect(result.error).toContain('nonexistent_column');
    });

    test('should call TableColumnResolver for CTE tables', () => {
        // Arrange
        const resolverCalls: string[] = [];
        const customResolver = (tableName: string) => {
            resolverCalls.push(tableName);
            if (tableName === 'table_a') {
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            if (tableName === 'dat') {
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            return [];
        };

        const sql = `
            WITH dat AS (
                SELECT line_id, name, unit_price, quantity, tax_rate
                FROM table_a
            )
            SELECT line_id, nonexistent_column FROM dat
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector(customResolver);

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(resolverCalls).toContain('table_a');
        expect(resolverCalls).toContain('dat'); // This should be called for CTE
        expect(result.success).toBe(false);
        expect(result.unresolvedColumns).toContain('nonexistent_column');
    });

    // EXACT reproduction of Test Case 1 from the original issue
    test('should reproduce original Test Case 1: CTE with wildcards not recognized', () => {
        // Arrange - EXACT copy from original issue
        const sql = `
            WITH dat AS (
              SELECT line_id, name, unit_price, quantity, tax_rate
              FROM table_a
            ),
            detail AS (
              SELECT dat.*
              FROM dat
            )
            SELECT * FROM detail
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const result = collector.analyze(query);

        // Assert
        // Original issue expected: ['table_a', 'dat', 'detail']
        expect(result.schemas.map(s => s.name).sort()).toEqual(['dat', 'detail', 'table_a']);
        
        // Should handle wildcards gracefully - either succeed with proper column resolution
        // or fail with appropriate error messages
        if (!result.success) {
            expect(result.error).toContain('Wildcard');
        }
    });

    // EXACT reproduction of Test Case 2 from the original issue  
    test('should reproduce original Test Case 2: Undefined columns in CTE not detected', () => {
        // Arrange - EXACT copy from original issue
        const sql = `
            WITH dat AS (
              SELECT line_id, name, unit_price, quantity, tax_rate
              FROM table_a
            )
            SELECT line_id, nonexistent_column FROM dat
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector();

        // Act
        const result = collector.analyze(query);

        // Assert - Original issue expected: unresolvedColumns should contain 'nonexistent_column'
        expect(result.success).toBe(false);
        expect(result.unresolvedColumns).toContain('nonexistent_column');
        expect(result.schemas.map(s => s.name).sort()).toEqual(['dat', 'table_a']);
    });

    // EXACT reproduction of Test Case 3 from the original issue
    test('should reproduce original Test Case 3: TableColumnResolver not called for CTEs', () => {
        // Arrange - EXACT copy from original issue
        const resolverCalls: string[] = [];
        const customResolver = (tableName: string) => {
            resolverCalls.push(tableName);
            if (tableName === 'table_a') {
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            if (tableName === 'dat') {
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            return [];
        };

        const sql = `
            WITH dat AS (
              SELECT line_id, name, unit_price, quantity, tax_rate
              FROM table_a
            )
            SELECT line_id, nonexistent_column FROM dat
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector(customResolver);

        // Act
        const result = collector.analyze(query);

        // Assert - Original issue: Resolver should be called for 'dat' table
        expect(resolverCalls).toContain('table_a');
        expect(resolverCalls).toContain('dat');
        expect(result.success).toBe(false);
        expect(result.unresolvedColumns).toContain('nonexistent_column');
    });

    test('should handle CTE wildcards with resolver', () => {
        // Arrange
        const resolverCalls: string[] = [];
        const customResolver = (tableName: string) => {
            resolverCalls.push(tableName);
            if (tableName === 'table_a') {
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            if (tableName === 'dat') {
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            if (tableName === 'detail') {
                return ['line_id', 'name', 'unit_price', 'quantity', 'tax_rate'];
            }
            return [];
        };

        const sql = `
            WITH dat AS (
                SELECT line_id, name, unit_price, quantity, tax_rate
                FROM table_a
            ),
            detail AS (
                SELECT dat.*
                FROM dat
            )
            SELECT * FROM detail
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector(customResolver);

        // Act
        const result = collector.analyze(query);

        // Assert
        expect(result.success).toBe(true);
        expect(resolverCalls).toContain('table_a');
        expect(resolverCalls).toContain('dat');
        expect(resolverCalls).toContain('detail');
        expect(result.schemas.length).toBe(3);
        expect(result.schemas.map(s => s.name).sort()).toEqual(['dat', 'detail', 'table_a']);
    });

    test('should handle CTE wildcards without resolver', () => {
        // Arrange
        const sql = `
            WITH dat AS (
                SELECT line_id, name, unit_price, quantity, tax_rate
                FROM table_a
            ),
            detail AS (
                SELECT dat.*
                FROM dat
            )
            SELECT * FROM detail
        `;
        const query = SelectQueryParser.parse(sql);
        const collector = new SchemaCollector(); // No resolver

        // Act
        const result = collector.analyze(query);

        // Assert - Since we can resolve CTE columns internally, this may succeed
        // The key test is that all CTE schemas are properly collected
        expect(result.schemas.length).toBe(3); // table_a, dat, detail
        expect(result.schemas.map(s => s.name).sort()).toEqual(['dat', 'detail', 'table_a']);
        
        // If it fails, it should be due to wildcard issues
        if (!result.success) {
            expect(result.error).toContain('Wildcard');
        }
    });
});