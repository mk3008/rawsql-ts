import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { CTENotFoundError } from '../../src/models/CTEError';

describe('SelectQuery CTE Management API', () => {
    const formatter = new SqlFormatter();

    describe('addCTE method', () => {
        test('should add CTE without materialized option', () => {
            // Red: This test will fail because addCTE method doesn't exist yet
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const result = mainQuery.addCTE('active_accounts', cteQuery);
            const formatted = formatter.format(result);
            
            expect(formatted.formattedSql.trim()).toBe(
                'with "active_accounts" as (select "id" from "accounts" where "active" = true) select * from "users"'
            );
        });

        test('should add CTE with materialized = true', () => {
            // Triangulation: Test with materialized option
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const result = mainQuery.addCTE('active_accounts', cteQuery, { materialized: true });
            const formatted = formatter.format(result);
            
            expect(formatted.formattedSql.trim()).toBe(
                'with "active_accounts" as materialized (select "id" from "accounts" where "active" = true) select * from "users"'
            );
        });

        test('should add CTE with materialized = false', () => {
            // Triangulation: Test with NOT MATERIALIZED
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const result = mainQuery.addCTE('active_accounts', cteQuery, { materialized: false });
            const formatted = formatter.format(result);
            
            expect(formatted.formattedSql.trim()).toBe(
                'with "active_accounts" as not materialized (select "id" from "accounts" where "active" = true) select * from "users"'
            );
        });

        test('should add multiple CTEs', () => {
            // Triangulation: Test multiple CTE additions
            const mainQuery = SelectQueryParser.parse('SELECT * FROM final_data').toSimpleQuery();
            const cte1 = SelectQueryParser.parse('SELECT id FROM users WHERE active = true');
            const cte2 = SelectQueryParser.parse('SELECT user_id FROM orders WHERE status = "completed"');
            
            const result = mainQuery
                .addCTE('active_users', cte1)
                .addCTE('completed_orders', cte2, { materialized: true });
            
            const formatted = formatter.format(result);
            
            expect(formatted.formattedSql.trim()).toContain('with "active_users" as');
            expect(formatted.formattedSql.trim()).toContain('"completed_orders" as materialized');
        });

        test('should return the same SelectQuery instance for method chaining', () => {
            // Test fluent API
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts');
            
            const result = mainQuery.addCTE('test_cte', cteQuery);
            
            expect(result).toBe(mainQuery); // Should return same instance
        });
    });

    describe('removeCTE method', () => {
        test('should remove existing CTE', () => {
            // Red: Test CTE removal
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const result = mainQuery
                .addCTE('active_accounts', cteQuery)
                .removeCTE('active_accounts');
            
            const formatted = formatter.format(result);
            
            // After removal, should not contain CTE
            expect(formatted.formattedSql.trim()).toBe('select * from "users"');
        });

        test('should remove specific CTE from multiple CTEs', () => {
            // Triangulation: Test selective removal
            const mainQuery = SelectQueryParser.parse('SELECT * FROM final_data').toSimpleQuery();
            const cte1 = SelectQueryParser.parse('SELECT id FROM users WHERE active = true');
            const cte2 = SelectQueryParser.parse('SELECT user_id FROM orders WHERE status = "completed"');
            
            const result = mainQuery
                .addCTE('active_users', cte1)
                .addCTE('completed_orders', cte2)
                .removeCTE('active_users');
            
            const formatted = formatter.format(result);
            
            expect(formatted.formattedSql.trim()).not.toContain('active_users');
            expect(formatted.formattedSql.trim()).toContain('"completed_orders"');
        });

        test('should throw CTENotFoundError for non-existent CTE removal', () => {
            // Edge case: Remove CTE that doesn't exist should throw error
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            
            expect(() => {
                mainQuery.removeCTE('non_existent');
            }).toThrow(CTENotFoundError);
        });
    });

    describe('hasCTE method', () => {
        test('should return true for existing CTE', () => {
            // Red: Test CTE existence check
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const result = mainQuery.addCTE('active_accounts', cteQuery);
            
            expect(result.hasCTE('active_accounts')).toBe(true);
        });

        test('should return false for non-existent CTE', () => {
            // Triangulation: Test negative case
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            
            expect(mainQuery.hasCTE('non_existent')).toBe(false);
        });

        test('should return false after CTE removal', () => {
            // Edge case: Check after removal
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const result = mainQuery
                .addCTE('active_accounts', cteQuery)
                .removeCTE('active_accounts');
            
            expect(result.hasCTE('active_accounts')).toBe(false);
        });
    });

    describe('getCTENames method', () => {
        test('should return empty array when no CTEs exist', () => {
            // Red: Test empty state
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            
            expect(mainQuery.getCTENames()).toEqual([]);
        });

        test('should return array with single CTE name', () => {
            // Basic case
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const result = mainQuery.addCTE('active_accounts', cteQuery);
            
            expect(result.getCTENames()).toEqual(['active_accounts']);
        });

        test('should return array with multiple CTE names in order', () => {
            // Triangulation: Multiple CTEs
            const mainQuery = SelectQueryParser.parse('SELECT * FROM final_data').toSimpleQuery();
            const cte1 = SelectQueryParser.parse('SELECT id FROM users WHERE active = true');
            const cte2 = SelectQueryParser.parse('SELECT user_id FROM orders WHERE status = "completed"');
            
            const result = mainQuery
                .addCTE('active_users', cte1)
                .addCTE('completed_orders', cte2);
            
            expect(result.getCTENames()).toEqual(['active_users', 'completed_orders']);
        });
    });

    describe('replaceCTE method', () => {
        test('should replace existing CTE', () => {
            // Red: Test CTE replacement
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const originalCTE = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            const newCTE = SelectQueryParser.parse('SELECT id, name FROM accounts WHERE status = "verified"');
            
            const result = mainQuery
                .addCTE('accounts_cte', originalCTE)
                .replaceCTE('accounts_cte', newCTE, { materialized: true });
            
            const formatted = formatter.format(result);
            
            expect(formatted.formattedSql.trim()).toContain('"accounts_cte" as materialized');
            expect(formatted.formattedSql.trim()).toContain('status');
            expect(formatted.formattedSql.trim()).not.toContain('active');
        });

        test('should add new CTE when replacing non-existent CTE', () => {
            // Edge case: Replace CTE that doesn't exist
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const newCTE = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');
            
            const result = mainQuery.replaceCTE('new_cte', newCTE);
            const formatted = formatter.format(result);
            
            expect(formatted.formattedSql.trim()).toContain('"new_cte"');
            expect(result.hasCTE('new_cte')).toBe(true);
        });

        test('should preserve other CTEs when replacing one', () => {
            // Triangulation: Multiple CTEs with replacement
            const mainQuery = SelectQueryParser.parse('SELECT * FROM final_data').toSimpleQuery();
            const cte1 = SelectQueryParser.parse('SELECT id FROM users WHERE active = true');
            const cte2 = SelectQueryParser.parse('SELECT user_id FROM orders WHERE status = "completed"');
            const newCTE2 = SelectQueryParser.parse('SELECT user_id FROM orders WHERE status = "delivered"');
            
            const result = mainQuery
                .addCTE('active_users', cte1)
                .addCTE('completed_orders', cte2)
                .replaceCTE('completed_orders', newCTE2, { materialized: false });
            
            const formatted = formatter.format(result);
            
            expect(formatted.formattedSql.trim()).toContain('"active_users"');
            expect(formatted.formattedSql.trim()).toContain('"completed_orders" as not materialized');
            expect(formatted.formattedSql.trim()).toContain('delivered');
            expect(formatted.formattedSql.trim()).not.toContain('"completed"');
        });

        test('should return the same SelectQuery instance for method chaining', () => {
            // Test fluent API for replaceCTE
            const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
            const cteQuery = SelectQueryParser.parse('SELECT id FROM accounts');
            
            const result = mainQuery.replaceCTE('test_cte', cteQuery);
            
            expect(result).toBe(mainQuery); // Should return same instance
        });
    });

    describe('BinarySelectQuery with CTE Management', () => {
        test('should enable CTE management through toSimpleQuery()', () => {
            // Test the new pattern: BinarySelectQuery -> toSimpleQuery() -> CTE operations
            const query1 = SelectQueryParser.parse('SELECT id FROM employees').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id FROM contractors');
            const cteQuery = SelectQueryParser.parse('SELECT id FROM departments WHERE active = true');
            
            const result = query1.toUnion(query2)
                .toSimpleQuery()
                .addCTE('active_departments', cteQuery);
            
            const formatted = formatter.format(result);
            
            expect(result.hasCTE('active_departments')).toBe(true);
            expect(formatted.formattedSql.trim()).toContain('with "active_departments"');
            expect(formatted.formattedSql.trim()).toContain('union');
        });

        test('should support complex CTE operations on converted binary queries', () => {
            // Test full CTE API on converted binary query
            const query1 = SelectQueryParser.parse('SELECT id, name FROM table1').toSimpleQuery();
            const query2 = SelectQueryParser.parse('SELECT id, name FROM table2');
            const cte1 = SelectQueryParser.parse('SELECT id FROM temp1');
            const cte2 = SelectQueryParser.parse('SELECT id FROM temp2');
            
            const simpleQuery = query1.toIntersect(query2).toSimpleQuery();
            
            // Test all CTE operations
            simpleQuery.addCTE('temp1', cte1, { materialized: true });
            simpleQuery.addCTE('temp2', cte2);
            
            expect(simpleQuery.hasCTE('temp1')).toBe(true);
            expect(simpleQuery.hasCTE('temp2')).toBe(true);
            expect(simpleQuery.getCTENames()).toEqual(['temp1', 'temp2']);
            
            // Test removal
            simpleQuery.removeCTE('temp1');
            expect(simpleQuery.hasCTE('temp1')).toBe(false);
            expect(simpleQuery.getCTENames()).toEqual(['temp2']);
            
            // Test replacement
            const newCTE = SelectQueryParser.parse('SELECT id FROM replacement');
            simpleQuery.replaceCTE('temp2', newCTE, { materialized: false });
            
            const formatted = formatter.format(simpleQuery);
            expect(formatted.formattedSql.trim()).toContain('"temp2" as not materialized');
            expect(formatted.formattedSql.trim()).toContain('replacement');
        });
    });
});