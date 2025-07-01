import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SchemaCollector } from '../../src/transformers/SchemaCollector';

/**
 * Tests for the new allowWildcardWithoutResolver option
 */
describe('SchemaCollector - allowWildcardWithoutResolver option', () => {
    
    describe('Default behavior (allowWildcardWithoutResolver = false)', () => {
        test('should throw error when wildcard used without TableColumnResolver', () => {
            // Arrange
            const sql = `SELECT * FROM users`;
            const query = SelectQueryParser.parse(sql);
            const collector = new SchemaCollector(); // No resolver, default option
            
            // Act & Assert
            expect(() => {
                collector.collect(query);
            }).toThrow('Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards. Target table: users');
        });

        test('should throw error for qualified wildcard without resolver', () => {
            // Arrange
            const sql = `SELECT u.* FROM users as u`;
            const query = SelectQueryParser.parse(sql);
            const collector = new SchemaCollector(null, false); // Explicitly false
            
            // Act & Assert
            expect(() => {
                collector.collect(query);
            }).toThrow('Wildcard (*) is used. A TableColumnResolver is required to resolve wildcards. Target table: users');
        });

        test('should throw error for multiple table wildcards', () => {
            // Arrange
            const sql = `SELECT u.*, p.* FROM users u JOIN posts p ON u.id = p.user_id`;
            const query = SelectQueryParser.parse(sql);
            const collector = new SchemaCollector();
            
            // Act & Assert
            expect(() => {
                collector.collect(query);
            }).toThrow(/Wildcard \(\*\) is used\. A TableColumnResolver is required/);
        });
    });

    describe('New option enabled (allowWildcardWithoutResolver = true)', () => {
        test('should allow wildcard without resolver when option is true', () => {
            // Arrange
            const sql = `SELECT * FROM users`;
            const query = SelectQueryParser.parse(sql);
            const collector = new SchemaCollector(null, true); // allowWildcardWithoutResolver = true
            
            // Act - should not throw
            const schemaInfo = collector.collect(query);
            
            // Assert
            expect(schemaInfo).toHaveLength(1);
            expect(schemaInfo[0].name).toBe('users');
            expect(schemaInfo[0].columns).toEqual([]); // Wildcards are excluded when no resolver
        });

        test('should handle qualified wildcards without throwing', () => {
            // Arrange
            const sql = `SELECT u.* FROM users as u`;
            const query = SelectQueryParser.parse(sql);
            const collector = new SchemaCollector(null, true);
            
            // Act
            const schemaInfo = collector.collect(query);
            
            // Assert
            expect(schemaInfo).toHaveLength(1);
            expect(schemaInfo[0].name).toBe('users');
            expect(schemaInfo[0].columns).toEqual([]); // Wildcard excluded
        });

        test('should handle simple explicit columns without JOIN', () => {
            // Arrange
            const sql = `SELECT name, email FROM users`;
            const query = SelectQueryParser.parse(sql);
            const collector = new SchemaCollector(null, true);
            
            // Act
            const schemaInfo = collector.collect(query);
            
            // Assert
            expect(schemaInfo).toHaveLength(1);
            expect(schemaInfo[0].name).toBe('users');
            expect(schemaInfo[0].columns).toEqual(['email', 'name']); // Alphabetical order
        });

        test('should work correctly with complex queries', () => {
            // Arrange
            const sql = `SELECT u.name FROM users u WHERE u.active = true`;
            const query = SelectQueryParser.parse(sql);
            const collector = new SchemaCollector(null, true);
            
            // Act
            const schemaInfo = collector.collect(query);
            
            // Assert
            expect(schemaInfo).toHaveLength(1);
            expect(schemaInfo[0].name).toBe('users');
            // Only SELECT clause columns are included (WHERE clause columns excluded with new option)
            expect(schemaInfo[0].columns).toEqual(['name']);
        });
    });

    describe('Backward compatibility verification', () => {
        test('should maintain exact same behavior when option is false', () => {
            // Arrange
            const sql = `SELECT * FROM users`;
            const query = SelectQueryParser.parse(sql);
            const oldCollector = new SchemaCollector(); // Old way
            const newCollector = new SchemaCollector(null, false); // New way, explicit false
            
            // Act & Assert - both should throw the same error
            expect(() => oldCollector.collect(query)).toThrow();
            expect(() => newCollector.collect(query)).toThrow();
            
            // Verify error messages are identical
            let oldError = '';
            let newError = '';
            
            try { oldCollector.collect(query); } catch (e) { oldError = (e as Error).message; }
            try { newCollector.collect(query); } catch (e) { newError = (e as Error).message; }
            
            expect(oldError).toBe(newError);
        });
    });
});