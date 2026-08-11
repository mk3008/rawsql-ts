import { describe, expect, test } from 'vitest';
import { SqlSchemaValidator } from '../../src/utils/SqlSchemaValidator';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { TableColumnResolver } from '../../src/transformers/TableColumnResolver';

describe('StaticAnalyzer', () => {
    test('returns typed diagnostics without throwing from analyze', () => {
        const result = SqlSchemaValidator.analyze(
            'SELECT users.id, users.missing FROM users JOIN absent ON users.id = absent.user_id',
            [{ name: 'users', columns: ['id'] }]
        );

        expect(result.valid).toBe(false);
        expect(result.diagnostics).toEqual([
            {
                code: 'TABLE_NOT_DEFINED',
                message: "Table 'absent' is not defined.",
                tableName: 'absent',
            },
            {
                code: 'COLUMN_NOT_DEFINED',
                columnName: 'missing',
                message: "Table 'users' contains undefined column: missing.",
                tableName: 'users',
            },
        ]);
    });

    test('resolves an unqualified column when exactly one physical source defines it', () => {
        const result = SqlSchemaValidator.analyze(
            'SELECT id FROM users JOIN accounts ON users.id = accounts.user_id',
            [
                { name: 'users', columns: ['id'] },
                { name: 'accounts', columns: ['user_id'] },
            ]
        );

        expect(result).toEqual({ diagnostics: [], valid: true });
    });

    test('returns ambiguous unqualified columns only when multiple physical sources define them', () => {
        const result = SqlSchemaValidator.analyze(
            'SELECT id FROM users JOIN accounts ON users.id = accounts.user_id',
            [
                { name: 'users', columns: ['id'] },
                { name: 'accounts', columns: ['id', 'user_id'] },
            ]
        );

        expect(result.valid).toBe(false);
        expect(result.diagnostics).toContainEqual({
            code: 'COLUMN_REFERENCE_AMBIGUOUS',
            columnNames: ['id'],
            message: 'Column reference(s) without table name found in query: id',
        });
    });

    test('keeps derived-source ownership unresolved instead of calling it ambiguous', () => {
        const result = SqlSchemaValidator.analyze(
            'SELECT id FROM (SELECT id FROM users) user_scope JOIN accounts ON user_scope.id = accounts.user_id',
            [
                { name: 'users', columns: ['id'] },
                { name: 'accounts', columns: ['user_id'] },
            ]
        );

        expect(result.valid).toBe(true);
        expect(result.diagnostics).toContainEqual({
            code: 'COLUMN_REFERENCE_UNRESOLVED',
            columnNames: ['id'],
            message: 'Column reference(s) without table name found in query: id',
        });
        expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ code: 'COLUMN_REFERENCE_AMBIGUOUS' }));
    });

    test('does not call a JOIN USING merged column ambiguous', () => {
        const result = SqlSchemaValidator.analyze(
            'SELECT id FROM users JOIN accounts USING (id)',
            [
                { name: 'users', columns: ['id'] },
                { name: 'accounts', columns: ['id'] },
            ]
        );

        expect(result.valid).toBe(true);
        expect(result.diagnostics).toContainEqual(expect.objectContaining({
            code: 'COLUMN_REFERENCE_UNRESOLVED',
            columnNames: ['id'],
        }));
        expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ code: 'COLUMN_REFERENCE_AMBIGUOUS' }));
    });

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
            SqlSchemaValidator.validate(query, mockResolver);
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
            SqlSchemaValidator.validate(query, mockResolver);
        }).toThrowError("Table 'users' contains undefined columns: age.");
    });

    test('preserves the legacy error text when multiple columns are undefined', () => {
        const query = SelectQueryParser.parse('SELECT age, status FROM users');
        const resolver: TableColumnResolver = (tableName) => tableName === 'users' ? ['id', 'name'] : [];

        expect(() => SqlSchemaValidator.validate(query, resolver))
            .toThrowError("Table 'users' contains undefined columns: age, status.");
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
            SqlSchemaValidator.validate(query, mockResolver);
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
            SqlSchemaValidator.validate(query, mockResolver);
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
            SqlSchemaValidator.validate(sql, tableSchemas);
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
            SqlSchemaValidator.validate(sql, tableSchemas);
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
            SqlSchemaValidator.validate(sql, tableSchemas);
        }).toThrowError("Table 'unknown_table' is not defined.");
    });
});
