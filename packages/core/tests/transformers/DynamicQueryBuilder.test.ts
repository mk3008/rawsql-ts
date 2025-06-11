import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicQueryBuilder } from '../../src/transformers/DynamicQueryBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('DynamicQueryBuilder', () => {
    let builder: DynamicQueryBuilder;

    beforeEach(() => {
        builder = new DynamicQueryBuilder();
    });

    describe('Basic SQL generation', () => {
        it('should return original SQL without filters', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';

            // Act
            const result = builder.buildQuery(sql);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql } = formatter.format(result);
            expect(formattedSql).toBe('select "id", "name" from "users" where "active" = true');
        });

        it('should add filter conditions', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const filter = { name: 'Alice' };

            // Act
            const result = builder.buildQuery(sql, { filter });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            expect(formattedSql).toBe('select "id", "name" from "users" where "active" = true and "name" = :name');
            expect(params).toEqual({ name: 'Alice' });
        });

        it('should add sort conditions', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const sort = { name: { asc: true } };

            // Act
            const result = builder.buildQuery(sql, { sort });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql } = formatter.format(result);
            expect(formattedSql).toBe('select "id", "name" from "users" where "active" = true order by "name"');
        });

        it('should add pagination conditions', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const paging = { page: 2, pageSize: 10 };

            // Act
            const result = builder.buildQuery(sql, { paging });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql } = formatter.format(result);
            expect(formattedSql).toBe('select "id", "name" from "users" where "active" = true limit 10 offset 10');
        });

        it('should combine all conditions', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const options = {
                filter: { name: 'Alice' },
                sort: { name: { desc: true } },
                paging: { page: 1, pageSize: 5 }
            };

            // Act
            const result = builder.buildQuery(sql, options);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            expect(formattedSql).toBe('select "id", "name" from "users" where "active" = true and "name" = :name order by "name" desc limit 5');
            expect(params).toEqual({ name: 'Alice' });
        });
    });

    describe('Convenience methods', () => {
        it('should apply filter only with buildFilteredQuery', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const filter = { name: 'Alice' }; // Use existing column

            // Act
            const result = builder.buildFilteredQuery(sql, filter);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            expect(formattedSql).toBe('select "id", "name" from "users" where "name" = :name');
            expect(params).toEqual({ name: 'Alice' });
        });

        it('should apply sort only with buildSortedQuery', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const sort = { id: { desc: true } };

            // Act
            const result = builder.buildSortedQuery(sql, sort);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql } = formatter.format(result);
            expect(formattedSql).toBe('select "id", "name" from "users" order by "id" desc');
        });

        it('should apply pagination only with buildPaginatedQuery', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const paging = { page: 3, pageSize: 20 };

            // Act
            const result = builder.buildPaginatedQuery(sql, paging);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql } = formatter.format(result);
            expect(formattedSql).toBe('select "id", "name" from "users" limit 20 offset 40');
        });

        it('should add serialization conditions', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const serialize = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { id: 'id', name: 'name' }
                },
                nestedEntities: []
            };

            // Act
            const result = builder.buildQuery(sql, { serialize });

            // Assert
            const formatter = new SqlFormatter(); const { formattedSql } = formatter.format(result);
            // Verify that JSON query is correctly generated (detailed format is verified in PostgresJsonQueryBuilder tests)
            expect(formattedSql).toContain('json_agg');
            expect(formattedSql).toContain('"user"');
        });

        it('should combine all features', () => {
            // Arrange
            const sql = 'SELECT id, name, email, status FROM users WHERE active = true';
            const options = {
                filter: { status: 'premium' },
                sort: { name: { asc: true } },
                paging: { page: 1, pageSize: 10 },
                serialize: {
                    rootName: 'user',
                    rootEntity: {
                        id: 'user',
                        name: 'User',
                        columns: { id: 'id', name: 'name', email: 'email', status: 'status' }
                    },
                    nestedEntities: []
                }
            };

            // Act
            const result = builder.buildQuery(sql, options);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql } = formatter.format(result);
            // Verify that all combined features are applied
            expect(formattedSql).toContain('json_agg'); // Serialization
            expect(formattedSql).toContain('limit'); // Pagination
            // Filter and sort are included in the inner query
        });
    });

    describe('Convenience methods - Serialization', () => {
        it('should apply serialization only with buildSerializedQuery', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const serialize = {
                rootName: 'user',
                rootEntity: {
                    id: 'user',
                    name: 'User',
                    columns: { id: 'id', name: 'name' }
                },
                nestedEntities: []
            };            // Act
            const result = builder.buildSerializedQuery(sql, serialize);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql } = formatter.format(result);
            expect(formattedSql).toContain('json_agg');
            expect(formattedSql).toContain('"user"');
        });
    });

    describe('Error handling', () => {
        it('should throw error for invalid SQL', () => {
            // Arrange
            const invalidSql = 'SELCT * FRM invalid_table';

            // Act & Assert
            expect(() => {
                builder.buildQuery(invalidSql);
            }).toThrow('Failed to parse SQL');
        });

        it('should validate valid SQL with validateSql', () => {
            // Arrange
            const validSql = 'SELECT id FROM users';

            // Act & Assert
            expect(builder.validateSql(validSql)).toBe(true);
        });

        it('should throw error for invalid SQL with validateSql', () => {
            // Arrange
            const invalidSql = 'SELCT * FRM invalid';

            // Act & Assert
            expect(() => {
                builder.validateSql(invalidSql);
            }).toThrow('Invalid SQL');
        });
    });
});
