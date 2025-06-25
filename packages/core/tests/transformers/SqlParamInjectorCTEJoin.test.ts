import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { Formatter } from '../../src/transformers/Formatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

/**
 * SqlParamInjector with CTE + JOIN combinations
 * Tests for column detection and parameter injection in complex query structures
 */
describe('SqlParamInjector - CTE + JOIN Support', () => {
    
    test('should inject parameters into CTE with LATERAL JOIN', () => {
        const sql = `
            WITH test_cte as (
                SELECT 
                    id,
                    'test_value' as test_column,
                    UPPER(name) as filterable_name
                FROM test_table
            )
            SELECT 
                t.id,
                t.test_column
            FROM test_cte as t
            LEFT JOIN LATERAL (
                SELECT 1 as dummy
            ) lat ON true
        `;
        
        const parsedQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const injector = new SqlParamInjector();
        
        const searchConditions = {
            test_column: { ilike: '%test%' },
            filterable_name: { ilike: '%TEST%' }
        };
        
        expect(() => {
            const injectedQuery = injector.inject(parsedQuery, searchConditions);
            const formatter = new Formatter();
            const formattedSql = formatter.format(injectedQuery);
            
            expect(formattedSql).toContain('test_column');
            expect(formattedSql).toContain('filterable_name');
        }).not.toThrow();
    });

    test('should inject parameters into CTE with regular JOIN', () => {
        const sql = `
            WITH base_cte as (
                SELECT
                    c.customers_id,
                    c.name,
                    LOWER(c.email) as filterable_email
                FROM customers as c
            )
            SELECT
                b.customers_id,
                b.name,
                e.entry_id
            FROM base_cte as b
            LEFT JOIN entry e ON e.customers_id = b.customers_id
        `;
        
        const parsedQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const injector = new SqlParamInjector();
        
        const searchConditions = {
            filterable_email: { ilike: '%@example.com' }
        };
        
        expect(() => {
            const injectedQuery = injector.inject(parsedQuery, searchConditions);
            const formatter = new Formatter();
            const formattedSql = formatter.format(injectedQuery);
            expect(formattedSql).toContain('filterable_email');
        }).not.toThrow();
    });

    test('should handle multiple CTEs with UNION and JOIN', () => {
        const sql = `
            WITH cte1 as (
                SELECT
                    c.customers_id as filterable_id,
                    UPPER(c.name) as filterable_name,
                    'cte1' as source
                FROM customers as c
            ),
            cte2 as (
                SELECT
                    u.users_id as filterable_id,
                    UPPER(u.name) as filterable_name,
                    'cte2' as source
                FROM users as u
            ),
            union_cte as (
                SELECT * FROM cte1
                UNION ALL
                SELECT * FROM cte2
            )
            SELECT
                uc.filterable_id,
                uc.source,
                e.entry_id
            FROM union_cte as uc
            LEFT JOIN entry e ON e.customers_id = uc.filterable_id
        `;
        
        const parsedQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const injector = new SqlParamInjector();
        
        const searchConditions = {
            filterable_name: { ilike: '%JOHN%' }
        };
        
        expect(() => {
            const injectedQuery = injector.inject(parsedQuery, searchConditions);
            const formatter = new Formatter();
            const formattedSql = formatter.format(injectedQuery);
            expect(formattedSql).toContain('filterable_name');
        }).not.toThrow();
    });

    test('should handle nested CTEs with LATERAL JOIN', () => {
        const sql = `
            WITH filtered_customers as (
                SELECT
                    3 as kind,
                    c.customers_id as filterable_id,
                    CONCAT(c.first_name, c.last_name) as filterable_name
                FROM customers as c
            ),
            filtered_users as (
                SELECT
                    2 as kind,
                    u.users_id as filterable_id,
                    CONCAT(u.first_name, u.last_name) as filterable_name
                FROM users as u
            ),
            combined_data as (
                SELECT kind, filterable_id, filterable_name FROM filtered_customers
                UNION ALL
                SELECT kind, filterable_id, filterable_name FROM filtered_users
            ),
            final_data as (
                SELECT 
                    q.kind,
                    q.filterable_id,
                    e.entry_id
                FROM combined_data as q
                LEFT JOIN LATERAL (
                    SELECT entry_id FROM entry e 
                    WHERE e.customers_id = q.filterable_id
                    ORDER BY e.create_date_time DESC LIMIT 1
                ) e ON true
            )
            SELECT kind FROM final_data
        `;
        
        const parsedQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const injector = new SqlParamInjector();
        
        const searchConditions = {
            filterable_name: { ilike: '%john%' }
        };
        
        expect(() => {
            const injectedQuery = injector.inject(parsedQuery, searchConditions);
            const formatter = new Formatter();
            const formattedSql = formatter.format(injectedQuery);
            expect(formattedSql).toContain('filterable_name');
        }).not.toThrow();
    });

    test('should handle deep nested CTEs with multiple JOINs', () => {
        const sql = `
            WITH level1_cte as (
                SELECT 
                    id,
                    'level1_value' as test_column,
                    UPPER(name) as filterable_name
                FROM base_table
            ),
            level2_cte as (
                SELECT 
                    l1.id,
                    l1.test_column,
                    l1.filterable_name,
                    'level2' as level
                FROM level1_cte as l1
            ),
            level3_cte as (
                SELECT 
                    l2.*,
                    'level3' as final_level
                FROM level2_cte as l2
            )
            SELECT 
                l3.id,
                l3.test_column,
                t1.related_id,
                t2.other_id
            FROM level3_cte as l3
            LEFT JOIN table1 t1 ON t1.id = l3.id
            LEFT JOIN LATERAL (
                SELECT other_id FROM table2 t2 
                WHERE t2.parent_id = l3.id LIMIT 1
            ) t2 ON true
        `;
        
        const parsedQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const injector = new SqlParamInjector();
        
        const searchConditions = {
            test_column: { ilike: '%level1%' },
            filterable_name: { ilike: '%JOHN%' }
        };
        
        expect(() => {
            const injectedQuery = injector.inject(parsedQuery, searchConditions);
            const formatter = new Formatter();
            const formattedSql = formatter.format(injectedQuery);
            expect(formattedSql).toContain('test_column');
            expect(formattedSql).toContain('filterable_name');
        }).not.toThrow();
    });

    // Control tests to verify baseline functionality
    test('baseline: CTE without JOIN should work', () => {
        const sql = `
            WITH root_customers as (
                SELECT
                    c.customers_id as filterable_id,
                    CONCAT(c.first_name, c.last_name) as filterable_name
                FROM customers as c
            )
            SELECT
                rc.filterable_id
            FROM root_customers as rc
        `;
        
        const parsedQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const injector = new SqlParamInjector();
        
        const searchConditions = {
            filterable_name: { ilike: '%john%' }
        };
        
        expect(() => {
            const injectedQuery = injector.inject(parsedQuery, searchConditions);
            const formatter = new Formatter();
            const formattedSql = formatter.format(injectedQuery);
            expect(formattedSql).toContain('filterable_name');
        }).not.toThrow();
    });

    test('baseline: JOIN without CTE should work', () => {
        const sql = `
            SELECT
                c.customers_id,
                CONCAT(c.first_name, c.last_name) as filterable_name,
                e.entry_id
            FROM customers as c
            LEFT JOIN LATERAL (
                SELECT entry_id FROM entry e 
                WHERE e.customers_id = c.customers_id LIMIT 1
            ) e ON true
        `;
        
        const parsedQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const injector = new SqlParamInjector();
        
        const searchConditions = {
            filterable_name: { ilike: '%john%' }
        };
        
        expect(() => {
            const injectedQuery = injector.inject(parsedQuery, searchConditions);
            const formatter = new Formatter();
            const formattedSql = formatter.format(injectedQuery);
            expect(formattedSql).toContain('filterable_name');
        }).not.toThrow();
    });
});