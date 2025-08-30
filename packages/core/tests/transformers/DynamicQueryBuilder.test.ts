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

    describe('Table.Column Notation Support', () => {
        it('should support backward compatible unqualified column names', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name, p.phone
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                WHERE u.active = true
            `;
            const filter = { 
                name: 'Alice',
                phone: '123-456-7890'
            };

            // Act
            const result = builder.buildQuery(sql, { filter });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            // Should add conditions for all matching columns (qualified output is expected when original SQL uses qualified names)
            expect(formattedSql).toContain('and "u"."name" = :name');
            expect(formattedSql).toContain('and "p"."phone" = :phone');
            expect(params).toEqual({
                name: 'Alice',
                phone: '123-456-7890'
            });
        });

        it('should support qualified column names with real table names', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name, p.id, p.name
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                WHERE u.active = true
            `;
            const filter = { 
                'users.name': 'Alice',        // Real table name
                'profiles.name': 'Profile Alice'  // Real table name
            };

            // Act
            const result = builder.buildQuery(sql, { filter });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            // Should create separate conditions for each real table name
            expect(formattedSql).toContain('"u"."name" = :users_name');
            expect(formattedSql).toContain('"p"."name" = :profiles_name');
            expect(params).toEqual({
                users_name: 'Alice',
                profiles_name: 'Profile Alice'
            });
        });

        it('should reject qualified column names with alias names', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name, p.id, p.name
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                WHERE u.active = true
            `;
            const filter = { 
                'u.name': 'Alice',   // Alias name - should be rejected
                'p.name': 'Profile Alice'  // Alias name - should be rejected
            };

            // Act & Assert
            expect(() => {
                builder.buildQuery(sql, { filter });
            }).toThrowError(/Only real table names are allowed in qualified column references.*not aliases/);
        });

        it('should support hybrid approach with real table names - qualified names override unqualified', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name, p.name, o.name
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                JOIN orders o ON u.id = o.user_id
                WHERE u.active = true
            `;
            const filter = {
                name: 'Default Name',          // Applies to all name columns
                'users.name': 'Alice',         // Overrides for users table (real table name)
                'profiles.name': 'Alice Profile'  // Overrides for profiles table (real table name)
                // orders.name should get 'Default Name'
            };

            // Act
            const result = builder.buildQuery(sql, { filter });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            // Should handle both qualified and unqualified names
            expect(formattedSql).toContain('"u"."name" = :users_name');
            expect(formattedSql).toContain('"p"."name" = :profiles_name');
            expect(formattedSql).toContain('"o"."name" = :name'); // Gets unqualified value
            expect(params).toEqual({
                name: 'Default Name',
                users_name: 'Alice',
                profiles_name: 'Alice Profile'
            });
        });

        it('should handle qualified real table names with complex conditions', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.age, p.age
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                WHERE u.active = true
            `;
            const filter = {
                'users.age': { min: 18, max: 65 },
                'profiles.age': { '>=': 21 }
            };

            // Act
            const result = builder.buildQuery(sql, { filter });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            expect(formattedSql).toContain('"u"."age" >= :users_age_min and "u"."age" <= :users_age_max');
            expect(formattedSql).toContain('"p"."age" >= :profiles_age_ge');
            expect(params).toEqual({
                users_age_min: 18,
                users_age_max: 65,
                profiles_age_ge: 21
            });
        });

        it('should handle qualified names with CTE queries', () => {
            // Arrange
            const sql = `
                WITH user_data AS (
                    SELECT u.id, u.name, u.email
                    FROM users u
                    WHERE u.active = true
                )
                SELECT ud.id, ud.name, p.name
                FROM user_data ud
                JOIN profiles p ON ud.id = p.user_id
            `;
            const filter = {
                'user_data.name': 'Alice',      // CTE name as real table name
                'profiles.name': 'Alice Profile' // Real table name  
            };

            // Act
            const result = builder.buildQuery(sql, { filter });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            expect(formattedSql).toContain('"ud"."name" = :user_data_name');
            expect(formattedSql).toContain('"p"."name" = :profiles_name');
            expect(params).toEqual({
                user_data_name: 'Alice',
                profiles_name: 'Alice Profile'
            });
        });

        it('should throw error for non-existent qualified table.column', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name
                FROM users u
                WHERE u.active = true
            `;
            const filter = {
                'nonexistent.name': 'Alice'
            };

            // Act & Assert
            expect(() => {
                builder.buildQuery(sql, { filter });
            }).toThrow("Column 'nonexistent.name' (qualified as nonexistent.name) not found in query");
        });

        it('should maintain backward compatibility with existing API', () => {
            // Arrange
            const sql = 'SELECT id, name, status FROM users WHERE active = true';
            const filter = {
                name: 'Alice',
                status: 'premium'
            };

            // Act
            const result = builder.buildQuery(sql, { filter });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            // Should work exactly as before (single table optimizes to no qualifier)
            expect(formattedSql).toContain('"name" = :name');
            expect(formattedSql).toContain('"status" = :status');
            expect(params).toEqual({
                name: 'Alice',
                status: 'premium'
            });
        });

        it('should handle edge cases with malformed qualified names', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name
                FROM users u
                WHERE u.active = true
            `;
            const filter = {
                '.name': 'Alice',        // Invalid: empty table name
                'table.': 'value',       // Invalid: empty column name
                'a.b.c': 'value'         // Invalid: too many dots
            };

            // Act & Assert
            // These should be treated as literal column names, not qualified names
            expect(() => {
                builder.buildQuery(sql, { filter });
            }).toThrow(); // Should fail because these literal column names don't exist
        });

        it('should support real table names with aliases', () => {
            // This test verifies the enhanced qualified name resolution works with real table names
            // Arrange
            const sql = `
                SELECT u.id, u.name, p.name
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                WHERE u.active = true
            `;
            const filter = {
                'users.name': 'Alice',         // Real table name with alias
                'profiles.name': 'Alice Profile' // Real table name with alias
            };

            // Act
            const result = builder.buildQuery(sql, { filter });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            // Should work even though query uses aliases 'u' and 'p'
            // The system should map 'users' -> 'u' and 'profiles' -> 'p'
            expect(formattedSql).toContain('"u"."name" = :users_name');
            expect(formattedSql).toContain('"p"."name" = :profiles_name');
            expect(params).toEqual({
                users_name: 'Alice',
                profiles_name: 'Alice Profile'
            });
        });

        it('should reject mixed real table names and aliases', () => {
            // Test that mixing real table names and alias names throws error
            // Arrange
            const sql = `
                SELECT u.id, u.name, p.name, o.total
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                JOIN orders o ON u.id = o.user_id
                WHERE u.active = true
            `;
            const filter = {
                'users.name': 'Alice',     // Real table name - OK
                'p.name': 'Alice Profile', // Alias name - should be rejected
                'orders.total': 100        // Real table name - OK
            };

            // Act & Assert
            // Should fail because 'p.name' uses alias name
            expect(() => {
                builder.buildQuery(sql, { filter });
            }).toThrowError(/Only real table names are allowed in qualified column references.*not aliases/);
        });

        it('should support only real table names consistently', () => {
            // Test using only real table names (should work)
            // Arrange
            const sql = `
                SELECT u.id, u.name, p.name, o.total
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                JOIN orders o ON u.id = o.user_id
                WHERE u.active = true
            `;
            const filter = {
                'users.name': 'Alice',         // Real table name
                'profiles.name': 'Alice Profile', // Real table name
                'orders.total': 100            // Real table name
            };

            // Act
            const result = builder.buildQuery(sql, { filter });

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            // Should handle all real table names correctly
            expect(formattedSql).toContain('"u"."name" = :users_name');
            expect(formattedSql).toContain('"p"."name" = :profiles_name');
            expect(formattedSql).toContain('"o"."total" = :orders_total');
            expect(params).toEqual({
                users_name: 'Alice',
                profiles_name: 'Alice Profile',
                orders_total: 100
            });
        });
    });
});
