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
        }); it('should add pagination conditions', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const paging = { page: 2, pageSize: 10 };

            // Act
            const result = builder.buildQuery(sql, { paging });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            expect(formattedSql).toBe('select "id", "name" from "users" where "active" = true limit :paging_limit offset :paging_offset');
            expect(params).toEqual({ paging_limit: 10, paging_offset: 10 });
        }); it('should combine all conditions', () => {
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
            expect(formattedSql).toBe('select "id", "name" from "users" where "active" = true and "name" = :name order by "name" desc limit :paging_limit offset :paging_offset');
            expect(params).toEqual({ name: 'Alice', paging_limit: 5, paging_offset: 0 });
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
        }); it('should apply pagination only with buildPaginatedQuery', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users';
            const paging = { page: 3, pageSize: 20 };

            // Act
            const result = builder.buildPaginatedQuery(sql, paging);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            expect(formattedSql).toBe('select "id", "name" from "users" limit :paging_limit offset :paging_offset');
            expect(params).toEqual({ paging_limit: 20, paging_offset: 40 });
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
            expect(formattedSql).toContain('jsonb_agg');
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
            expect(formattedSql).toContain('jsonb_agg'); // Serialization
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
            expect(formattedSql).toContain('jsonb_agg');
            expect(formattedSql).toContain('"user"');
        });
    });

    describe('Hardcoded parameter handling', () => {
        it('should bind values to hardcoded parameters in SQL', () => {
            // Arrange - SQL with hardcoded parameters
            const sql = 'select year_month from sale_summary where year_month = :ym limit :limit';
            const options = {
                filter: {
                    ym: '2024-06',   
                    limit: 10
                }
            };

            // Act
            const result = builder.buildQuery(sql, options);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            expect(formattedSql).toBe('select "year_month" from "sale_summary" where "year_month" = :ym limit :limit');
            expect(params).toEqual({ ym: '2024-06', limit: 10 });
        });

        it('should handle mixed hardcoded and dynamic parameters', () => {
            // Arrange - SQL with hardcoded parameter + table columns for dynamic filtering
            const sql = 'select id, name, status, created_at from users where created_at >= :start_date';
            const options = {
                filter: {
                    start_date: '2024-01-01',  // Hardcoded parameter
                    status: 'active'           // Dynamic filter (will add WHERE condition)
                }
            };

            // Act
            const result = builder.buildQuery(sql, options);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            // Should bind hardcoded parameter and add dynamic WHERE condition
            expect(formattedSql).toBe('select "id", "name", "status", "created_at" from "users" where "created_at" >= :start_date and "status" = :status');
            expect(params).toEqual({ 
                start_date: '2024-01-01',
                status: 'active'
            });
        });

        it('should bind hardcoded limit parameter correctly', () => {
            // Arrange
            const sql = 'select * from users limit :limit';
            
            // Using filter for hardcoded limit parameter (now supported)
            const optionsWithFilter = {
                filter: { limit: 10 }
            };

            // Act
            const resultWithFilter = builder.buildQuery(sql, optionsWithFilter);
            
            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql: sqlWithFilter, params: paramsWithFilter } = formatter.format(resultWithFilter);
            
            // Filter approach should bind to hardcoded :limit parameter
            expect(sqlWithFilter).toBe('select * from "users" limit :limit');
            expect(paramsWithFilter).toEqual({ limit: 10 });
        });

        it('should handle paging option with existing limit parameter', () => {
            // Arrange
            const sql = 'select * from users';
            
            // Using paging option (existing functionality)
            const optionsWithPaging = {
                paging: { page: 1, pageSize: 10 }
            };

            // Act
            const resultWithPaging = builder.buildQuery(sql, optionsWithPaging);
            
            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql: sqlWithPaging, params: paramsWithPaging } = formatter.format(resultWithPaging);
            
            // Paging approach should add new LIMIT/OFFSET clauses
            expect(sqlWithPaging).toBe('select * from "users" limit :paging_limit offset :paging_offset');
            expect(paramsWithPaging).toEqual({ paging_limit: 10, paging_offset: 0 });
        });

        it('should handle only dynamic filters when no hardcoded parameters exist', () => {
            // Arrange - SQL without hardcoded parameters
            const sql = 'select id, name, status from users where active = true';
            const options = {
                filter: {
                    name: 'John',
                    status: 'premium'
                }
            };

            // Act
            const result = builder.buildQuery(sql, options);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            // Should add dynamic WHERE conditions only
            expect(formattedSql).toBe('select "id", "name", "status" from "users" where "active" = true and "name" = :name and "status" = :status');
            expect(params).toEqual({ 
                name: 'John',
                status: 'premium'
            });
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
