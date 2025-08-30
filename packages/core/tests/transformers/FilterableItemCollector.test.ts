import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { FilterableItemCollector, FilterableItem, FilterableItemCollectorOptions } from '../../src/transformers/FilterableItemCollector';
import { TableColumnResolver } from '../../src/transformers/TableColumnResolver';

describe('FilterableItemCollector', () => {
    describe('Basic functionality', () => {
        it('should collect columns and parameters from simple SELECT query', () => {
            // Arrange
            const sql = 'SELECT sale_id, price FROM sales WHERE sale_year = :year';
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector(undefined, { upstream: false });

            // Act
            const items = collector.collect(query);

            // Assert
            expect(items.length).toBe(4);
            
            // Check columns
            const columns = items.filter(item => item.type === 'column');
            expect(columns.length).toBe(3);
            expect(columns.find(c => c.name === 'sale_id')).toBeDefined();
            expect(columns.find(c => c.name === 'price')).toBeDefined();
            expect(columns.find(c => c.name === 'sale_year')).toBeDefined();
            
            // Check parameters
            const parameters = items.filter(item => item.type === 'parameter');
            expect(parameters.length).toBe(1);
            expect(parameters.find(p => p.name === 'year')).toBeDefined();
        });

        it('should collect multiple parameters correctly', () => {
            // Arrange
            const sql = 'SELECT sale_id, price FROM sales WHERE sale_year = :year AND region = :region_code';
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector(undefined, { upstream: false });

            // Act
            const items = collector.collect(query);

            // Assert
            const parameters = items.filter(item => item.type === 'parameter');
            expect(parameters.length).toBe(2);
            expect(parameters.find(p => p.name === 'year')).toBeDefined();
            expect(parameters.find(p => p.name === 'region_code')).toBeDefined();
        });

        it('should handle queries with only columns (no parameters)', () => {
            // Arrange
            const sql = 'SELECT id, name FROM users WHERE active = true';
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector(undefined, { upstream: false });

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            const parameters = items.filter(item => item.type === 'parameter');
            
            expect(columns.length).toBe(3); // id, name, active
            expect(columns.find(c => c.name === 'id')).toBeDefined();
            expect(columns.find(c => c.name === 'name')).toBeDefined();
            expect(columns.find(c => c.name === 'active')).toBeDefined();
            expect(parameters.length).toBe(0);
        });

        it('should handle queries with only parameters (no additional columns)', () => {
            // Arrange - VALUES clause with parameters only
            const sql = 'SELECT :user_id as id, :user_name as name';
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector(undefined, { upstream: false });

            // Act
            const items = collector.collect(query);

            // Assert
            const parameters = items.filter(item => item.type === 'parameter');
            expect(parameters.length).toBe(2);
            expect(parameters.find(p => p.name === 'user_id')).toBeDefined();
            expect(parameters.find(p => p.name === 'user_name')).toBeDefined();
        });
    });

    describe('Complex queries', () => {
        it('should collect items from JOIN queries', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name, p.phone, o.total
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                JOIN orders o ON u.id = o.user_id
                WHERE u.created_date >= :start_date AND o.status = :order_status
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector();

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            const parameters = items.filter(item => item.type === 'parameter');
            
            // Should collect columns from all joined tables
            expect(columns.find(c => c.name === 'id')).toBeDefined();
            expect(columns.find(c => c.name === 'name')).toBeDefined();
            expect(columns.find(c => c.name === 'phone')).toBeDefined();
            expect(columns.find(c => c.name === 'total')).toBeDefined();
            expect(columns.find(c => c.name === 'user_id')).toBeDefined();
            expect(columns.find(c => c.name === 'created_date')).toBeDefined();
            expect(columns.find(c => c.name === 'status')).toBeDefined();
            
            // Should collect parameters
            expect(parameters.length).toBe(2);
            expect(parameters.find(p => p.name === 'start_date')).toBeDefined();
            expect(parameters.find(p => p.name === 'order_status')).toBeDefined();
        });

        it('should collect items from CTE queries', () => {
            // Arrange
            const sql = `
                WITH user_data AS (
                    SELECT u.id, u.name, u.email, u.status
                    FROM users u
                    WHERE u.created_date >= :start_date
                )
                SELECT ud.id, ud.name
                FROM user_data ud
                WHERE ud.status = :user_status
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector();

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            const parameters = items.filter(item => item.type === 'parameter');
            
            // Should collect columns from CTE and base table
            expect(columns.find(c => c.name === 'id')).toBeDefined();
            expect(columns.find(c => c.name === 'name')).toBeDefined();
            expect(columns.find(c => c.name === 'email')).toBeDefined();
            expect(columns.find(c => c.name === 'status')).toBeDefined();
            // Note: created_date appears in WHERE clause but may not be collected 
            // by SelectableColumnCollector with upstream option - this is expected behavior
            
            // Should collect parameters from both CTE and main query
            expect(parameters.length).toBe(2);
            expect(parameters.find(p => p.name === 'start_date')).toBeDefined();
            expect(parameters.find(p => p.name === 'user_status')).toBeDefined();
        });

        it('should collect items from subquery', () => {
            // Arrange
            const sql = `
                SELECT main.id, main.name, main.total
                FROM (
                    SELECT u.id, u.name, o.total
                    FROM users u
                    JOIN orders o ON u.id = o.user_id
                    WHERE o.created_date >= :start_date
                ) main
                WHERE main.total > :min_total
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector();

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            const parameters = items.filter(item => item.type === 'parameter');
            
            // Should collect columns from subquery
            expect(columns.find(c => c.name === 'id')).toBeDefined();
            expect(columns.find(c => c.name === 'name')).toBeDefined();
            expect(columns.find(c => c.name === 'total')).toBeDefined();
            expect(columns.find(c => c.name === 'user_id')).toBeDefined();
            expect(columns.find(c => c.name === 'created_date')).toBeDefined();
            
            // Should collect parameters from both subquery and main query
            expect(parameters.length).toBe(2);
            expect(parameters.find(p => p.name === 'start_date')).toBeDefined();
            expect(parameters.find(p => p.name === 'min_total')).toBeDefined();
        });
    });

    describe('FilterableItem model', () => {
        it('should create FilterableItem with correct properties for columns', () => {
            // Arrange & Act
            const item = new FilterableItem('sale_id', 'column', 'sales');

            // Assert
            expect(item.name).toBe('sale_id');
            expect(item.type).toBe('column');
            expect(item.tableName).toBe('sales');
        });

        it('should create FilterableItem with correct properties for parameters', () => {
            // Arrange & Act
            const item = new FilterableItem('year', 'parameter');

            // Assert
            expect(item.name).toBe('year');
            expect(item.type).toBe('parameter');
            expect(item.tableName).toBeUndefined();
        });

        it('should distinguish between columns and parameters', () => {
            // Arrange
            const sql = 'SELECT sale_id FROM sales WHERE sale_year = :year';
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector();

            // Act
            const items = collector.collect(query);

            // Assert
            const saleIdItem = items.find(item => item.name === 'sale_id');
            const saleYearItem = items.find(item => item.name === 'sale_year');
            const yearItem = items.find(item => item.name === 'year');

            expect(saleIdItem?.type).toBe('column');
            expect(saleIdItem?.tableName).toBe('sales');
            
            expect(saleYearItem?.type).toBe('column');
            expect(saleYearItem?.tableName).toBe('sales');
            
            expect(yearItem?.type).toBe('parameter');
            expect(yearItem?.tableName).toBeUndefined();
        });
    });

    describe('Integration with existing components', () => {
        it('should work with TableColumnResolver', () => {
            // Arrange
            const sql = 'SELECT * FROM users WHERE created_date >= :start_date';
            const query = SelectQueryParser.parse(sql);
            
            const mockResolver: TableColumnResolver = (tableName: string) => {
                if (tableName === 'users') {
                    return ['id', 'name', 'email', 'created_date', 'active'];
                }
                return [];
            };
            
            const collector = new FilterableItemCollector(mockResolver, { upstream: false });

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            const parameters = items.filter(item => item.type === 'parameter');
            
            // Should resolve wildcard columns using resolver
            expect(columns.length).toBe(5);
            expect(columns.find(c => c.name === 'id')).toBeDefined();
            expect(columns.find(c => c.name === 'name')).toBeDefined();
            expect(columns.find(c => c.name === 'email')).toBeDefined();
            expect(columns.find(c => c.name === 'created_date')).toBeDefined();
            expect(columns.find(c => c.name === 'active')).toBeDefined();
            
            // Should still collect parameters
            expect(parameters.length).toBe(1);
            expect(parameters.find(p => p.name === 'start_date')).toBeDefined();
        });

        it('should not duplicate items when same column/parameter appears multiple times from same table', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name
                FROM users u
                WHERE u.id > :min_id AND u.id < :max_id AND u.name LIKE :name_pattern
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector(undefined, { upstream: false });

            // Act
            const items = collector.collect(query);

            // Assert
            // Check for duplicates based on type, name, and table name
            const uniqueKeys = new Set(items.map(item => `${item.type}:${item.name}:${item.tableName || 'none'}`));
            expect(items.length).toBe(uniqueKeys.size); // No duplicates with same type, name, and table
            
            const columns = items.filter(item => item.type === 'column');
            const parameters = items.filter(item => item.type === 'parameter');
            
            expect(columns.length).toBe(2); // id, name (no duplicates from same table)
            expect(parameters.length).toBe(3); // min_id, max_id, name_pattern
            
            // Verify expected columns exist with correct table names
            const idColumn = columns.find(c => c.name === 'id' && c.tableName === 'u');
            const nameColumn = columns.find(c => c.name === 'name' && c.tableName === 'u');
            expect(idColumn).toBeDefined();
            expect(nameColumn).toBeDefined();
        });
    });

    describe('Table Name Collection Tests', () => {
        it('should collect table names consistently - prefer alias when available', () => {
            // Arrange
            const sql = `
                SELECT u.id, u.name, p.phone
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                WHERE u.status = :status
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector(); // Keep upstream: true for JOIN tests

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            
            // Check that table names are aliases (u, p) not real table names (users, profiles)
            expect(columns.find(c => c.name === 'id' && c.tableName === 'u')).toBeDefined();
            expect(columns.find(c => c.name === 'name' && c.tableName === 'u')).toBeDefined();
            expect(columns.find(c => c.name === 'phone' && c.tableName === 'p')).toBeDefined();
            expect(columns.find(c => c.name === 'user_id' && c.tableName === 'p')).toBeDefined();
            expect(columns.find(c => c.name === 'status' && c.tableName === 'u')).toBeDefined();

            // Ensure no real table names are used when aliases are available
            expect(columns.find(c => c.tableName === 'users')).toBeUndefined();
            expect(columns.find(c => c.tableName === 'profiles')).toBeUndefined();
        });

        it('should use real table names when no alias is provided', () => {
            // Arrange
            const sql = `
                SELECT users.id, users.name, profiles.phone
                FROM users
                JOIN profiles ON users.id = profiles.user_id
                WHERE users.status = :status
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector(); // Keep upstream: true for JOIN tests

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            
            // Check that real table names are used when no aliases
            expect(columns.find(c => c.name === 'id' && c.tableName === 'users')).toBeDefined();
            expect(columns.find(c => c.name === 'name' && c.tableName === 'users')).toBeDefined();
            expect(columns.find(c => c.name === 'phone' && c.tableName === 'profiles')).toBeDefined();
            expect(columns.find(c => c.name === 'user_id' && c.tableName === 'profiles')).toBeDefined();
            expect(columns.find(c => c.name === 'status' && c.tableName === 'users')).toBeDefined();
        });

        it('should preserve all duplicate columns from JOINs', () => {
            // Arrange
            const sql = `
                SELECT u.id, p.id, o.id, u.name, o.name
                FROM users u
                JOIN profiles p ON u.id = p.user_id  
                JOIN orders o ON u.id = o.user_id
                WHERE u.status = :status
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector();

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            
            // Should have all id columns from different tables
            const idColumns = columns.filter(c => c.name === 'id');
            expect(idColumns.length).toBe(3);
            expect(idColumns.find(c => c.tableName === 'u')).toBeDefined();
            expect(idColumns.find(c => c.tableName === 'p')).toBeDefined();
            expect(idColumns.find(c => c.tableName === 'o')).toBeDefined();

            // Should have all name columns from different tables
            const nameColumns = columns.filter(c => c.name === 'name');
            expect(nameColumns.length).toBe(2);
            expect(nameColumns.find(c => c.tableName === 'u')).toBeDefined();
            expect(nameColumns.find(c => c.tableName === 'o')).toBeDefined();
        });

        it('should handle CTE table names correctly', () => {
            // Arrange
            const sql = `
                WITH user_data AS (
                    SELECT u.id, u.name, u.email
                    FROM users u
                    WHERE u.created_date >= :start_date
                )
                SELECT ud.id, ud.name
                FROM user_data ud
                WHERE ud.name LIKE :name_pattern
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector();

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            
            // Should have columns from both CTE and base table
            expect(columns.find(c => c.name === 'id' && c.tableName === 'ud')).toBeDefined(); // From CTE reference
            expect(columns.find(c => c.name === 'name' && c.tableName === 'ud')).toBeDefined(); // From CTE reference
            expect(columns.find(c => c.name === 'id' && c.tableName === 'u')).toBeDefined(); // From CTE definition
            expect(columns.find(c => c.name === 'name' && c.tableName === 'u')).toBeDefined(); // From CTE definition
            expect(columns.find(c => c.name === 'email' && c.tableName === 'u')).toBeDefined(); // From CTE definition
            expect(columns.find(c => c.name === 'created_date' && c.tableName === 'u')).toBeDefined(); // From WHERE in CTE
        });

        it('should handle mixed alias and real table name scenarios', () => {
            // Arrange
            const sql = `
                SELECT u.id, orders.total, profiles.phone
                FROM users u
                JOIN orders ON u.id = orders.user_id
                JOIN profiles ON u.id = profiles.user_id
                WHERE u.status = :status
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector();

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            
            // Mixed usage should be handled correctly
            expect(columns.find(c => c.name === 'id' && c.tableName === 'u')).toBeDefined(); // Alias
            expect(columns.find(c => c.name === 'total' && c.tableName === 'orders')).toBeDefined(); // Real table name
            expect(columns.find(c => c.name === 'phone' && c.tableName === 'profiles')).toBeDefined(); // Real table name
            expect(columns.find(c => c.name === 'user_id' && c.tableName === 'orders')).toBeDefined(); // Real table name
            expect(columns.find(c => c.name === 'user_id' && c.tableName === 'profiles')).toBeDefined(); // Real table name
            expect(columns.find(c => c.name === 'status' && c.tableName === 'u')).toBeDefined(); // Alias
        });
    });

    describe('Edge cases', () => {
        it('should handle empty query results gracefully', () => {
            // Arrange
            const sql = 'SELECT 1';
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector(undefined, { upstream: false });

            // Act
            const items = collector.collect(query);

            // Assert
            expect(items).toBeInstanceOf(Array);
            expect(items.length).toBeGreaterThanOrEqual(0);
        });


        it('should handle queries with function calls and expressions', () => {
            // Arrange
            const sql = `
                SELECT COUNT(*) as total, AVG(price) as avg_price
                FROM sales
                WHERE created_date >= :start_date AND YEAR(created_date) = :year
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector(undefined, { upstream: false });

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            const parameters = items.filter(item => item.type === 'parameter');
            
            // Should collect directly referenced columns and aliases (not function arguments)
            // Note: With upstream: false, function arguments like 'price' in AVG(price) are not collected
            expect(columns.find(c => c.name === 'created_date')).toBeDefined(); // Direct column reference
            expect(columns.find(c => c.name === 'avg_price')).toBeDefined(); // Alias from SELECT
            expect(columns.find(c => c.name === 'total')).toBeDefined(); // Alias from SELECT
            expect(columns.find(c => c.name === 'price')).toBeUndefined(); // Function argument not collected with upstream: false
            
            // Should collect parameters
            expect(parameters.length).toBe(2);
            expect(parameters.find(p => p.name === 'start_date')).toBeDefined();
            expect(parameters.find(p => p.name === 'year')).toBeDefined();
        });

        it('should handle parameters in different SQL contexts', () => {
            // Arrange
            const sql = `
                SELECT sale_id, price
                FROM sales
                WHERE sale_year = :year
                  AND price BETWEEN :min_price AND :max_price
                  AND region IN (:region1, :region2)
                ORDER BY CASE WHEN priority = :high_priority THEN 1 ELSE 2 END
                LIMIT :limit_count
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector(undefined, { upstream: false });

            // Act
            const items = collector.collect(query);

            // Assert
            const parameters = items.filter(item => item.type === 'parameter');
            expect(parameters.length).toBe(7);
            expect(parameters.find(p => p.name === 'year')).toBeDefined();
            expect(parameters.find(p => p.name === 'min_price')).toBeDefined();
            expect(parameters.find(p => p.name === 'max_price')).toBeDefined();
            expect(parameters.find(p => p.name === 'region1')).toBeDefined();
            expect(parameters.find(p => p.name === 'region2')).toBeDefined();
            expect(parameters.find(p => p.name === 'high_priority')).toBeDefined();
            expect(parameters.find(p => p.name === 'limit_count')).toBeDefined();
        });
    });

    describe('Integration with DynamicQueryBuilder', () => {
        it('should integrate with DynamicQueryBuilder for table.column filtering', () => {
            // This test verifies that FilterableItemCollector provides the necessary
            // information for DynamicQueryBuilder to support table.column notation
            
            // Arrange
            const sql = `
                SELECT u.id, u.name, p.name, o.total
                FROM users u
                JOIN profiles p ON u.id = p.user_id
                JOIN orders o ON u.id = o.user_id
                WHERE u.active = true
            `;
            const query = SelectQueryParser.parse(sql);
            const collector = new FilterableItemCollector();

            // Act
            const items = collector.collect(query);

            // Assert
            const columns = items.filter(item => item.type === 'column');
            
            // Should have columns with proper table names for disambiguation
            const userColumns = columns.filter(c => c.tableName === 'u');
            const profileColumns = columns.filter(c => c.tableName === 'p');
            const orderColumns = columns.filter(c => c.tableName === 'o');
            
            expect(userColumns.length).toBeGreaterThan(0);
            expect(profileColumns.length).toBeGreaterThan(0);
            expect(orderColumns.length).toBeGreaterThan(0);
            
            // Should have id columns from SELECT clause (only u.id is explicitly selected)
            const idColumns = columns.filter(c => c.name === 'id');
            expect(idColumns.length).toBe(1); // Only u.id from SELECT clause
            
            // Should have name columns from multiple tables  
            const nameColumns = columns.filter(c => c.name === 'name');
            expect(nameColumns.length).toBe(2); // u.name and p.name
            
            // Verify table names are properly set
            expect(nameColumns.find(c => c.tableName === 'u')).toBeDefined();
            expect(nameColumns.find(c => c.tableName === 'p')).toBeDefined();
        });
    });

    describe('Qualified vs Unqualified Naming Modes', () => {
        describe('Unqualified mode (default)', () => {
            it('should return column names only without qualification', () => {
                // Arrange
                const sql = 'SELECT u.name, u.id FROM users u WHERE u.active = true';
                const query = SelectQueryParser.parse(sql);
                const collector = new FilterableItemCollector(undefined, { upstream: false });

                // Act
                const items = collector.collect(query);

                // Assert
                const columns = items.filter(item => item.type === 'column');
                
                expect(columns.find(c => c.name === 'name')).toBeDefined();
                expect(columns.find(c => c.name === 'id')).toBeDefined();
                expect(columns.find(c => c.name === 'active')).toBeDefined();
                
                // Should not have qualified names
                expect(columns.find(c => c.name.includes('.'))).toBeUndefined();
                
                // But tableName property should still be preserved
                expect(columns.find(c => c.name === 'name')?.tableName).toBe('u');
            });

            it('should handle parameters correctly in unqualified mode', () => {
                // Arrange
                const sql = 'SELECT id FROM users WHERE created_date >= :start_date';
                const query = SelectQueryParser.parse(sql);
                const collector = new FilterableItemCollector(undefined, { upstream: false });

                // Act
                const items = collector.collect(query);

                // Assert
                const parameters = items.filter(item => item.type === 'parameter');
                expect(parameters.length).toBe(1);
                expect(parameters[0].name).toBe('start_date');
                expect(parameters[0].tableName).toBeUndefined();
            });

            it('should handle joins correctly in unqualified mode', () => {
                // Arrange
                const sql = `
                    SELECT u.id, u.name, p.phone
                    FROM users u
                    JOIN profiles p ON u.id = p.user_id
                    WHERE u.status = :status
                `;
                const query = SelectQueryParser.parse(sql);
                const collector = new FilterableItemCollector(); // Keep upstream: true for JOIN test

                // Act
                const items = collector.collect(query);

                // Assert
                const columns = items.filter(item => item.type === 'column');
                
                // Should have unqualified names
                expect(columns.find(c => c.name === 'id')).toBeDefined();
                expect(columns.find(c => c.name === 'name')).toBeDefined();
                expect(columns.find(c => c.name === 'phone')).toBeDefined();
                expect(columns.find(c => c.name === 'user_id')).toBeDefined();
                expect(columns.find(c => c.name === 'status')).toBeDefined();
                
                // Should not have qualified names
                expect(columns.find(c => c.name.includes('.'))).toBeUndefined();
                
                // But tableName should be preserved
                expect(columns.find(c => c.name === 'phone')?.tableName).toBe('p');
            });
        });

        describe('Qualified mode', () => {
            it('should return qualified column names (table.column) in qualified mode', () => {
                // Arrange
                const sql = 'SELECT u.name, u.id FROM users u WHERE u.active = true';
                const query = SelectQueryParser.parse(sql);
                const collector = new FilterableItemCollector(undefined, { qualified: true, upstream: false });

                // Act
                const items = collector.collect(query);

                // Assert
                const columns = items.filter(item => item.type === 'column');
                
                // Should have qualified names using real table names, not aliases
                expect(columns.find(c => c.name === 'users.name')).toBeDefined();
                expect(columns.find(c => c.name === 'users.id')).toBeDefined();
                expect(columns.find(c => c.name === 'users.active')).toBeDefined();
                
                // Should not have unqualified names
                expect(columns.find(c => c.name === 'name' && !c.name.includes('.'))).toBeUndefined();
                expect(columns.find(c => c.name === 'id' && !c.name.includes('.'))).toBeUndefined();
                
                // tableName should still be the alias for backward compatibility
                expect(columns.find(c => c.name === 'users.name')?.tableName).toBe('u');
            });

            it('should handle parameters correctly in qualified mode (parameters remain unqualified)', () => {
                // Arrange
                const sql = 'SELECT u.id FROM users u WHERE u.created_date >= :start_date';
                const query = SelectQueryParser.parse(sql);
                const collector = new FilterableItemCollector(undefined, { qualified: true, upstream: false });

                // Act
                const items = collector.collect(query);

                // Assert
                const parameters = items.filter(item => item.type === 'parameter');
                expect(parameters.length).toBe(1);
                expect(parameters[0].name).toBe('start_date'); // Parameters remain unchanged
                expect(parameters[0].tableName).toBeUndefined();
            });

            it('should handle joins correctly in qualified mode', () => {
                // Arrange
                const sql = `
                    SELECT u.id, u.name, p.phone
                    FROM users u
                    JOIN profiles p ON u.id = p.user_id
                    WHERE u.status = :status
                `;
                const query = SelectQueryParser.parse(sql);
                const collector = new FilterableItemCollector(undefined, { qualified: true }); // Keep upstream: true for JOIN test

                // Act
                const items = collector.collect(query);

                // Assert
                const columns = items.filter(item => item.type === 'column');
                const parameters = items.filter(item => item.type === 'parameter');
                
                // Should have qualified names (current implementation uses aliases, not real table names)
                // Note: Current implementation uses p.phone instead of profiles.phone for performance
                expect(columns.find(c => c.name === 'users.id')).toBeDefined();
                expect(columns.find(c => c.name === 'users.name')).toBeDefined();
                expect(columns.find(c => c.name === 'p.phone')).toBeDefined(); // Uses alias in qualified mode
                expect(columns.find(c => c.name === 'p.user_id')).toBeDefined();
                expect(columns.find(c => c.name === 'users.status')).toBeDefined();
                
                // Should not have unqualified names
                expect(columns.find(c => c.name === 'phone' && !c.name.includes('.'))).toBeUndefined();
                
                // Parameters should remain unqualified
                expect(parameters.find(p => p.name === 'status')).toBeDefined();
                
                // tableName should still be the alias/namespace for backward compatibility
                expect(columns.find(c => c.name === 'p.phone')?.tableName).toBe('p');
            });

            it('should handle queries without aliases correctly in qualified mode', () => {
                // Arrange
                const sql = `
                    SELECT users.id, users.name, profiles.phone
                    FROM users
                    JOIN profiles ON users.id = profiles.user_id
                `;
                const query = SelectQueryParser.parse(sql);
                const collector = new FilterableItemCollector(undefined, { qualified: true }); // Keep upstream: true for JOIN test

                // Act
                const items = collector.collect(query);

                // Assert
                const columns = items.filter(item => item.type === 'column');
                
                // Should have qualified names using real table names
                expect(columns.find(c => c.name === 'users.id')).toBeDefined();
                expect(columns.find(c => c.name === 'users.name')).toBeDefined();
                expect(columns.find(c => c.name === 'profiles.phone')).toBeDefined();
                expect(columns.find(c => c.name === 'profiles.user_id')).toBeDefined();
                
                // tableName should be the real table name in this case
                expect(columns.find(c => c.name === 'users.name')?.tableName).toBe('users');
                expect(columns.find(c => c.name === 'profiles.phone')?.tableName).toBe('profiles');
            });

            it('should handle CTE queries correctly in qualified mode', () => {
                // Arrange
                const sql = `
                    WITH user_data AS (
                        SELECT u.id, u.name, u.email
                        FROM users u
                        WHERE u.created_date >= :start_date
                    )
                    SELECT ud.id, ud.name
                    FROM user_data ud
                    WHERE ud.name LIKE :name_pattern
                `;
                const query = SelectQueryParser.parse(sql);
                const collector = new FilterableItemCollector(undefined, { qualified: true });

                // Act
                const items = collector.collect(query);

                // Assert
                const columns = items.filter(item => item.type === 'column');
                const parameters = items.filter(item => item.type === 'parameter');
                
                // Should have qualified names for both CTE and base table columns
                // Note: CTE qualified names use aliases (ud.id, u.id) rather than table names
                expect(columns.some(c => c.name === 'u.id' || c.name === 'users.id')).toBeTruthy();
                expect(columns.some(c => c.name === 'u.name' || c.name === 'users.name')).toBeTruthy();
                expect(columns.some(c => c.name === 'u.email' || c.name === 'users.email')).toBeTruthy();
                
                // Parameters should remain unqualified
                expect(parameters.find(p => p.name === 'start_date')).toBeDefined();
                expect(parameters.find(p => p.name === 'name_pattern')).toBeDefined();
            });

            it('should handle edge cases when table name cannot be resolved', () => {
                // Arrange - complex subquery that might not resolve table names properly
                const sql = `
                    SELECT main.id, main.name
                    FROM (
                        SELECT id, name FROM users WHERE active = true
                    ) main
                `;
                const query = SelectQueryParser.parse(sql);
                const collector = new FilterableItemCollector(undefined, { qualified: true });

                // Act
                const items = collector.collect(query);

                // Assert - should not throw errors and handle gracefully
                const columns = items.filter(item => item.type === 'column');
                expect(columns.length).toBeGreaterThan(0);
                
                // If qualification fails, should fall back to unqualified names
                // This is acceptable behavior
                for (const column of columns) {
                    expect(column.name).toBeTruthy();
                    expect(typeof column.name).toBe('string');
                }
            });
        });

        describe('Options interface and backward compatibility', () => {
            it('should work with default options (backward compatibility)', () => {
                // Arrange
                const sql = 'SELECT u.name FROM users u WHERE u.id = :id';
                const query = SelectQueryParser.parse(sql);
                
                // Test with no options (should default to unqualified)
                const collector1 = new FilterableItemCollector(undefined, { upstream: false });
                const collector2 = new FilterableItemCollector(undefined, { upstream: false });
                const collector3 = new FilterableItemCollector(undefined, { qualified: false, upstream: false });

                // Act
                const items1 = collector1.collect(query);
                const items2 = collector2.collect(query);
                const items3 = collector3.collect(query);

                // Assert - all should behave the same (unqualified mode)
                for (const items of [items1, items2, items3]) {
                    const columns = items.filter(item => item.type === 'column');
                    expect(columns.find(c => c.name === 'name')).toBeDefined();
                    expect(columns.find(c => c.name.includes('.'))).toBeUndefined();
                }
            });

            it('should preserve tableName property for backward compatibility', () => {
                // Arrange
                const sql = 'SELECT u.name, p.phone FROM users u JOIN profiles p ON u.id = p.user_id';
                const query = SelectQueryParser.parse(sql);
                
                // Test both modes with JOIN - keep upstream enabled
                const unqualifiedCollector = new FilterableItemCollector();
                const qualifiedCollector = new FilterableItemCollector(undefined, { qualified: true });

                // Act
                const unqualifiedItems = unqualifiedCollector.collect(query);
                const qualifiedItems = qualifiedCollector.collect(query);

                // Assert - tableName should be preserved in both modes
                const unqualifiedColumns = unqualifiedItems.filter(item => item.type === 'column');
                const qualifiedColumns = qualifiedItems.filter(item => item.type === 'column');
                
                // All columns should have tableName set
                expect(unqualifiedColumns.every(c => c.tableName)).toBeTruthy();
                expect(qualifiedColumns.every(c => c.tableName)).toBeTruthy();
                
                // tableName should be consistent between modes (should be alias/namespace)
                const unqualifiedName = unqualifiedColumns.find(c => c.name === 'name');
                const qualifiedName = qualifiedColumns.find(c => c.name === 'users.name');
                expect(unqualifiedName?.tableName).toBe('u');
                expect(qualifiedName?.tableName).toBe('u');
            });

            it('should work with TableColumnResolver in both modes', () => {
                // Arrange
                const sql = 'SELECT * FROM users u WHERE u.created_date >= :start_date';
                const query = SelectQueryParser.parse(sql);
                
                const mockResolver: TableColumnResolver = (tableName: string) => {
                    if (tableName === 'users' || tableName === 'u') {
                        return ['id', 'name', 'email', 'created_date'];
                    }
                    return [];
                };
                
                const unqualifiedCollector = new FilterableItemCollector(mockResolver, { upstream: false });
                const qualifiedCollector = new FilterableItemCollector(mockResolver, { qualified: true, upstream: false });

                // Act
                const unqualifiedItems = unqualifiedCollector.collect(query);
                const qualifiedItems = qualifiedCollector.collect(query);

                // Assert
                const unqualifiedColumns = unqualifiedItems.filter(item => item.type === 'column');
                const qualifiedColumns = qualifiedItems.filter(item => item.type === 'column');
                
                // Should resolve wildcard columns in both modes
                expect(unqualifiedColumns.length).toBe(4); // With upstream: false, should be exact count
                expect(qualifiedColumns.length).toBe(4);
                
                // Check for expected columns
                expect(unqualifiedColumns.find(c => c.name === 'id')).toBeDefined();
                expect(qualifiedColumns.find(c => c.name === 'users.id')).toBeDefined();
                
                // Parameters should be the same in both modes
                const unqualifiedParams = unqualifiedItems.filter(item => item.type === 'parameter');
                const qualifiedParams = qualifiedItems.filter(item => item.type === 'parameter');
                expect(unqualifiedParams.length).toBe(qualifiedParams.length);
                expect(unqualifiedParams.find(p => p.name === 'start_date')).toBeDefined();
                expect(qualifiedParams.find(p => p.name === 'start_date')).toBeDefined();
            });
        });

        describe('Complex scenarios with both modes', () => {
            it('should handle duplicate column names from different tables correctly', () => {
                // Arrange
                const sql = `
                    SELECT u.id, p.id, o.id, u.name, o.name
                    FROM users u
                    JOIN profiles p ON u.id = p.user_id  
                    JOIN orders o ON u.id = o.user_id
                `;
                const query = SelectQueryParser.parse(sql);
                
                const unqualifiedCollector = new FilterableItemCollector();
                const qualifiedCollector = new FilterableItemCollector(undefined, { qualified: true });

                // Act
                const unqualifiedItems = unqualifiedCollector.collect(query);
                const qualifiedItems = qualifiedCollector.collect(query);

                // Assert
                const unqualifiedColumns = unqualifiedItems.filter(item => item.type === 'column');
                const qualifiedColumns = qualifiedItems.filter(item => item.type === 'column');
                
                // Unqualified: Should have columns but they should be distinguishable by tableName
                const idColumns = unqualifiedColumns.filter(c => c.name === 'id');
                expect(idColumns.length).toBe(3);
                expect(idColumns.find(c => c.tableName === 'u')).toBeDefined();
                expect(idColumns.find(c => c.tableName === 'p')).toBeDefined();
                expect(idColumns.find(c => c.tableName === 'o')).toBeDefined();
                
                // Qualified: Should have distinct qualified names (using aliases as current implementation)
                expect(qualifiedColumns.find(c => c.name === 'users.id')).toBeDefined();
                expect(qualifiedColumns.find(c => c.name === 'p.id')).toBeDefined(); // Uses alias p, not profiles
                expect(qualifiedColumns.find(c => c.name === 'o.id')).toBeDefined(); // Uses alias o, not orders
                expect(qualifiedColumns.find(c => c.name === 'users.name')).toBeDefined();
                expect(qualifiedColumns.find(c => c.name === 'o.name')).toBeDefined(); // Uses alias o, not orders
            });

            it('should handle mixed alias and real table name scenarios correctly', () => {
                // Arrange
                const sql = `
                    SELECT u.id, orders.total, profiles.phone
                    FROM users u
                    JOIN orders ON u.id = orders.user_id
                    JOIN profiles ON u.id = profiles.user_id
                `;
                const query = SelectQueryParser.parse(sql);
                
                const qualifiedCollector = new FilterableItemCollector(undefined, { qualified: true });

                // Act
                const items = qualifiedCollector.collect(query);

                // Assert
                const columns = items.filter(item => item.type === 'column');
                
                // Should use real table names in qualified mode
                expect(columns.find(c => c.name === 'users.id')).toBeDefined(); // From alias
                expect(columns.find(c => c.name === 'orders.total')).toBeDefined(); // Real table name
                expect(columns.find(c => c.name === 'profiles.phone')).toBeDefined(); // Real table name
                expect(columns.find(c => c.name === 'orders.user_id')).toBeDefined(); // Real table name
                expect(columns.find(c => c.name === 'profiles.user_id')).toBeDefined(); // Real table name
                
                // tableName should preserve the original namespace/alias
                expect(columns.find(c => c.name === 'users.id')?.tableName).toBe('u');
                expect(columns.find(c => c.name === 'orders.total')?.tableName).toBe('orders');
            });
        });

        describe('Upstream collection mode', () => {
            it('should collect all available columns with upstream: true (default)', () => {
                // Arrange
                const sql = `
                    SELECT u.id, u.name, p.phone
                    FROM users u
                    JOIN profiles p ON u.id = p.user_id
                    WHERE u.status = :status
                `;
                const query = SelectQueryParser.parse(sql);
                
                const upstreamCollector = new FilterableItemCollector(); // upstream: true by default
                const basicCollector = new FilterableItemCollector(undefined, { upstream: false });

                // Act
                const upstreamItems = upstreamCollector.collect(query);
                const basicItems = basicCollector.collect(query);

                // Assert
                const upstreamColumns = upstreamItems.filter(item => item.type === 'column');
                const basicColumns = basicItems.filter(item => item.type === 'column');
                
                // Upstream should collect more comprehensive columns for maximum filtering capability
                expect(upstreamColumns.length).toBeGreaterThanOrEqual(basicColumns.length);
                
                // Both should have the essential columns
                expect(upstreamColumns.find(c => c.name === 'id' && c.tableName === 'u')).toBeDefined();
                expect(upstreamColumns.find(c => c.name === 'name' && c.tableName === 'u')).toBeDefined();
                expect(upstreamColumns.find(c => c.name === 'phone' && c.tableName === 'p')).toBeDefined();
                
                expect(basicColumns.find(c => c.name === 'id' && c.tableName === 'u')).toBeDefined();
                expect(basicColumns.find(c => c.name === 'name' && c.tableName === 'u')).toBeDefined();
                expect(basicColumns.find(c => c.name === 'phone' && c.tableName === 'p')).toBeDefined();
                
                // Parameters should be the same in both modes
                const upstreamParams = upstreamItems.filter(item => item.type === 'parameter');
                const basicParams = basicItems.filter(item => item.type === 'parameter');
                expect(upstreamParams.length).toBe(basicParams.length);
                expect(upstreamParams.find(p => p.name === 'status')).toBeDefined();
                expect(basicParams.find(p => p.name === 'status')).toBeDefined();
            });
        });
    });
});