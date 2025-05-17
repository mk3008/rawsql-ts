import { describe, expect, test } from 'vitest';
import { SqlStaticAnalyzer } from '../../src/utils/SqlStaticAnalyzer';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { TableColumnResolver } from '../../src/transformers/TableColumnResolver';

describe('StaticAnalyzer', () => {
    test('validates a SQL query with correct columns', () => {
        // Arrange
        const sql = `SELECT id, name FROM users`;
        const query = SelectQueryParser.parse(sql);
        const mockResolver: TableColumnResolver = (tableName) => {
            if (tableName === 'users') {
                return ['id', 'name'];
            }
            return [];
        };

        // Act & Assert
        expect(() => {
            SqlStaticAnalyzer.analyze(query, mockResolver);
        }).not.toThrow();
    });

    test('throws error for undefined columns', () => {
        // Arrange
        const sql = `SELECT id, age FROM users`;
        const query = SelectQueryParser.parse(sql);
        const mockResolver: TableColumnResolver = (tableName) => {
            if (tableName === 'users') {
                return ['id', 'name'];
            }
            return [];
        };

        // Act & Assert
        expect(() => {
            SqlStaticAnalyzer.analyze(query, mockResolver);
        }).toThrowError("Table 'users' contains undefined columns: age.");
    });

    test('throws error for undefined table', () => {
        // Arrange
        const sql = `SELECT id, name FROM unknown_table`;
        const query = SelectQueryParser.parse(sql);
        const mockResolver: TableColumnResolver = (tableName) => {
            if (tableName === 'users') {
                return ['id', 'name'];
            }
            return [];
        };

        // Act & Assert
        expect(() => {
            SqlStaticAnalyzer.analyze(query, mockResolver);
        }).toThrowError("Table 'unknown_table' is not defined.");
    });

    test('throws error for multiple undefined tables', () => {
        // Arrange
        const sql = `SELECT id, name FROM unknown_table1 UNION SELECT id, name FROM unknown_table2`;
        const query = SelectQueryParser.parse(sql);
        const mockResolver: TableColumnResolver = (tableName) => {
            if (tableName === 'users') {
                return ['id', 'name'];
            }
            return [];
        };

        // Act & Assert
        expect(() => {
            SqlStaticAnalyzer.analyze(query, mockResolver);
        }).toThrowError("Table 'unknown_table1' is not defined.\nTable 'unknown_table2' is not defined.");
    });

    test('validates a SQL query with correct columns using TableSchema[]', () => {
        // Arrange
        const sql = `SELECT id, name FROM users`;
        const tableSchemas = [
            { name: 'users', columns: ['id', 'name'] }
        ];

        // Act & Assert
        expect(() => {
            SqlStaticAnalyzer.analyze(sql, tableSchemas);
        }).not.toThrow();
    });

    test('throws error for undefined columns using TableSchema[]', () => {
        // Arrange
        const sql = `SELECT id, age FROM users`;
        const tableSchemas = [
            { name: 'users', columns: ['id', 'name'] }
        ];

        // Act & Assert
        expect(() => {
            SqlStaticAnalyzer.analyze(sql, tableSchemas);
        }).toThrowError("Table 'users' contains undefined columns: age.");
    });

    test('throws error for undefined table using TableSchema[]', () => {
        // Arrange
        const sql = `SELECT id, name FROM unknown_table`;
        const tableSchemas = [
            { name: 'users', columns: ['id', 'name'] }
        ];

        // Act & Assert
        expect(() => {
            SqlStaticAnalyzer.analyze(sql, tableSchemas);
        }).toThrowError("Table 'unknown_table' is not defined.");
    });
});
