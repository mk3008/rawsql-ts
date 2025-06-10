import { describe, test, expect } from 'vitest';
import { SqlSortInjector, SortConditions } from '../../src/transformers/SqlSortInjector';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlSortInjector', () => {
    describe('Basic Sort Injection', () => {
        test('should inject single ASC sort condition', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const sortConditions: SortConditions = {
                name: { asc: true }
            };
            const injector = new SqlSortInjector();

            // Act
            const result = injector.inject(sql, sortConditions);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select "id", "name" from "users" order by "name"');
        });

        test('should inject single DESC sort condition', () => {
            // Arrange
            const sql = 'SELECT id, name, created_at FROM users';
            const sortConditions: SortConditions = {
                created_at: { desc: true }
            };
            const injector = new SqlSortInjector();

            // Act
            const result = injector.inject(sql, sortConditions);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select "id", "name", "created_at" from "users" order by "created_at" desc');
        });

        test('should inject multiple sort conditions', () => {
            // Arrange
            const sql = 'SELECT id, name, age FROM users';
            const sortConditions: SortConditions = {
                name: { asc: true },
                age: { desc: true }
            };
            const injector = new SqlSortInjector();

            // Act
            const result = injector.inject(sql, sortConditions);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select "id", "name", "age" from "users" order by "name", "age" desc');
        });
    });

    describe('NULLS Position', () => {
        test('should handle nullsFirst option', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const sortConditions: SortConditions = {
                name: { asc: true, nullsFirst: true }
            };
            const injector = new SqlSortInjector();

            // Act
            const result = injector.inject(sql, sortConditions);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select "id", "name" from "users" order by "name" nulls first');
        });

        test('should handle nullsLast option', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const sortConditions: SortConditions = {
                name: { desc: true, nullsLast: true }
            };
            const injector = new SqlSortInjector();

            // Act
            const result = injector.inject(sql, sortConditions);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select "id", "name" from "users" order by "name" desc nulls last');
        });

        test('should handle only nulls position without explicit sort direction', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const sortConditions: SortConditions = {
                name: { nullsLast: true }
            };
            const injector = new SqlSortInjector();

            // Act
            const result = injector.inject(sql, sortConditions);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select "id", "name" from "users" order by "name" nulls last');
        });
    });

    describe('Append to Existing ORDER BY', () => {
        test('should append to existing ORDER BY clause', () => {
            // Arrange
            const sql = 'SELECT id, name, age FROM users ORDER BY id ASC';
            const sortConditions: SortConditions = {
                name: { desc: true }
            };
            const injector = new SqlSortInjector();

            // Act
            const result = injector.inject(sql, sortConditions);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select "id", "name", "age" from "users" order by "id", "name" desc');
        });
    });

    describe('Column Alias Support', () => {
        test('should work with column aliases', () => {
            // Arrange
            const sql = 'SELECT user_id AS id, user_name AS name FROM users';
            const sortConditions: SortConditions = {
                id: { asc: true },
                name: { desc: true }
            };
            const injector = new SqlSortInjector();

            // Act
            const result = injector.inject(sql, sortConditions);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select "user_id" as "id", "user_name" as "name" from "users" order by "user_id", "user_name" desc');
        });

        test('should work with calculated expressions as aliases', () => {
            // Arrange
            const sql = 'SELECT *, CASE WHEN age > 18 THEN \'adult\' ELSE \'minor\' END AS category FROM users';
            const sortConditions: SortConditions = {
                category: { desc: true }
            };
            const injector = new SqlSortInjector();

            // Act
            const result = injector.inject(sql, sortConditions);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select *, case when "age" > 18 then \'adult\' else \'minor\' end as "category" from "users" order by case when "age" > 18 then \'adult\' else \'minor\' end desc');
        });
    });

    describe('removeOrderBy static method', () => {
        test('should remove existing ORDER BY clause', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users ORDER BY id ASC, name DESC';

            // Act
            const result = SqlSortInjector.removeOrderBy(sql);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select "id", "name" from "users"');
        });

        test('should work with queries without ORDER BY', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';

            // Act
            const result = SqlSortInjector.removeOrderBy(sql);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select "id", "name" from "users"');
        });
    });

    describe('Error Handling', () => {
        test('should throw error for non-existent column', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const sortConditions: SortConditions = {
                nonexistent_column: { asc: true }
            };
            const injector = new SqlSortInjector();

            // Act & Assert
            expect(() => {
                injector.inject(sql, sortConditions);
            }).toThrow("Column or alias 'nonexistent_column' not found in current query");
        });

        test('should throw error for conflicting sort directions', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const sortConditions: SortConditions = {
                name: { asc: true, desc: true }
            };
            const injector = new SqlSortInjector();

            // Act & Assert
            expect(() => {
                injector.inject(sql, sortConditions);
            }).toThrow("Conflicting sort directions for column 'name': both asc and desc specified");
        });

        test('should throw error for conflicting nulls positions', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const sortConditions: SortConditions = {
                name: { nullsFirst: true, nullsLast: true }
            };
            const injector = new SqlSortInjector();

            // Act & Assert
            expect(() => {
                injector.inject(sql, sortConditions);
            }).toThrow("Conflicting nulls positions for column 'name': both nullsFirst and nullsLast specified");
        });

        test('should throw error for empty sort condition', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const sortConditions: SortConditions = {
                name: {}
            };
            const injector = new SqlSortInjector();

            // Act & Assert
            expect(() => {
                injector.inject(sql, sortConditions);
            }).toThrow("Empty sort condition for column 'name': at least one sort option must be specified");
        });
    });

    describe('TableColumnResolver Support', () => {
        test('should work with SELECT * using tableColumnResolver', () => {
            // Arrange
            const sql = 'SELECT * FROM users';
            const tableColumnResolver = (tableName: string) => {
                if (tableName.toLowerCase() === 'users') {
                    return ['id', 'name', 'email', 'created_at'];
                }
                return [];
            };
            const sortConditions: SortConditions = {
                name: { asc: true },
                created_at: { desc: true }
            };
            const injector = new SqlSortInjector(tableColumnResolver);

            // Act
            const result = injector.inject(sql, sortConditions);

            // Assert
            const formatter = new SqlFormatter();
            const formatted = formatter.format(result);
            expect(formatted.formattedSql).toBe('select * from "users" order by "users"."name", "users"."created_at" desc');
        });
    });
});
