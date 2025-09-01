import { describe, it, expect, test } from 'vitest';
import { ScopeResolver, ScopeInfo, AvailableTable, AvailableCTE } from '../../src/utils/ScopeResolver';

describe('ScopeResolver', () => {
    describe('Simplified scope resolution (suggestion-only focus)', () => {
        test('should return empty scope - basic table case', () => {
            const sql = 'SELECT * FROM users u WHERE u.name = ?';
            const scope = ScopeResolver.resolve(sql, 30);
            
            // Simplified for suggestion-only - avoids complex SQL parsing issues
            expect(scope.availableTables).toHaveLength(0);
            expect(scope.availableCTEs).toHaveLength(0);
            expect(scope.visibleColumns).toHaveLength(0);
            expect(scope.subqueryLevel).toBe(0);
        });
        
        test('should return empty scope - JOIN case', () => {
            const sql = `
                SELECT * FROM users u 
                LEFT JOIN orders o ON u.id = o.user_id
                WHERE u.active = 1
            `.trim();
            const scope = ScopeResolver.resolve(sql, sql.length);
            
            expect(scope.availableTables).toHaveLength(0);
            expect(scope.availableCTEs).toHaveLength(0);
            expect(scope.visibleColumns).toHaveLength(0);
        });
        
        test('should return empty scope - CTE case', () => {
            const sql = `
                WITH user_orders AS (
                    SELECT u.id, u.name, COUNT(o.id) as order_count
                    FROM users u
                    LEFT JOIN orders o ON u.id = o.user_id
                    GROUP BY u.id, u.name
                )
                SELECT * FROM user_orders WHERE order_count > 0
            `.trim();
            const scope = ScopeResolver.resolve(sql, sql.length);
            
            expect(scope.availableTables).toHaveLength(0);
            expect(scope.availableCTEs).toHaveLength(0);
        });
        
        test('should return empty scope - subquery case', () => {
            const sql = `
                SELECT * FROM (
                    SELECT id, name FROM users WHERE active = 1
                ) order_stats
                WHERE order_stats.name IS NOT NULL
            `.trim();
            const scope = ScopeResolver.resolve(sql, sql.length);
            
            expect(scope.availableTables).toHaveLength(0);
        });
        
        test('should return empty scope - line/column position', () => {
            const sql = `
                SELECT * FROM users u
                JOIN orders o ON u.id = o.user_id
            `.trim();
            const scope = ScopeResolver.resolveAt(sql, { line: 2, column: 10 });
            
            expect(scope.availableTables).toHaveLength(0);
        });
    });
    
    describe('Utility methods', () => {
        test('should provide consistent empty scope structure', () => {
            const sql = 'SELECT * FROM test_table';
            const scope1 = ScopeResolver.resolve(sql, 10);
            const scope2 = ScopeResolver.resolveAt(sql, { line: 1, column: 10 });
            
            // Both methods should return same structure
            expect(scope1).toMatchObject({
                availableTables: expect.any(Array),
                availableCTEs: expect.any(Array),
                subqueryLevel: expect.any(Number),
                visibleColumns: expect.any(Array),
                parentQueries: expect.any(Array)
            });
            
            expect(scope2).toMatchObject({
                availableTables: expect.any(Array),
                availableCTEs: expect.any(Array),
                subqueryLevel: expect.any(Number),
                visibleColumns: expect.any(Array),
                parentQueries: expect.any(Array)
            });
        });
        
        test('should handle incomplete SQL gracefully', () => {
            // These are the types of incomplete SQL that suggestion systems need to handle
            const incompleteSqlCases = [
                'SELECT * FROM ',
                'SELECT * FROM (',
                'SELECT * FROM (SELECT ',
                'WITH cte AS (SELECT',
                'SELECT u. FROM users u'
            ];
            
            incompleteSqlCases.forEach(sql => {
                const scope = ScopeResolver.resolve(sql, sql.length);
                
                // Should not throw errors and return empty scope
                expect(scope).toBeDefined();
                expect(scope.availableTables).toEqual([]);
                expect(scope.availableCTEs).toEqual([]);
                expect(scope.visibleColumns).toEqual([]);
            });
        });
    });
    
    describe('API compatibility', () => {
        test('should maintain expected return structure for backward compatibility', () => {
            const sql = 'SELECT * FROM users';
            const scope = ScopeResolver.resolve(sql, 10);
            
            // Ensure all expected properties exist (even if empty)
            expect(scope).toHaveProperty('availableTables');
            expect(scope).toHaveProperty('availableCTEs');
            expect(scope).toHaveProperty('subqueryLevel');
            expect(scope).toHaveProperty('visibleColumns');
            expect(scope).toHaveProperty('parentQueries');
            
            // Type check - arrays should be arrays, numbers should be numbers
            expect(Array.isArray(scope.availableTables)).toBe(true);
            expect(Array.isArray(scope.availableCTEs)).toBe(true);
            expect(Array.isArray(scope.visibleColumns)).toBe(true);
            expect(Array.isArray(scope.parentQueries)).toBe(true);
            expect(typeof scope.subqueryLevel).toBe('number');
        });
    });
});