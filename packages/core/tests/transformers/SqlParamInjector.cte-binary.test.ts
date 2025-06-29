import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { BinarySelectQuery } from '../../src/models/BinarySelectQuery';

// Common formatter configuration for readable test output
const createFormatter = () => new SqlFormatter({
    identifierEscape: { start: "", end: "" },
    parameterSymbol: ":",
    parameterStyle: "named",
    indentSize: 4,
    indentChar: " ",
    newline: "\n",
    keywordCase: "lower",
    commaBreak: "before",
    andBreak: "before"
});

/**
 * Test that BinarySelectQuery (UNION/INTERSECT/EXCEPT) within CTEs 
 * can be processed for column collection without errors
 */
describe('SqlParamInjector - BinarySelectQuery in CTE Column Collection', () => {
    
    test('should inject parameter into CTE containing UNION ALL', () => {
        // Arrange: parse query with UNION ALL in CTE
        const sql = `SELECT * FROM (
            WITH union_cte as (
                SELECT id, name FROM table1
                UNION ALL
                SELECT id, name FROM table2
            )
            SELECT * FROM union_cte
        ) subq`;
        const baseQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        
        // Arrange: prepare search conditions
        const searchConditions = {
            name: { ilike: '%test%' }
        };
        
        // Act: inject parameters
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, searchConditions);
        
        // Act: format SQL and extract parameters
        const formatter = createFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);
        
        // Assert: SQL contains parameters injected into each UNION branch
        expect(formattedSql).toBe(`select
    *
from
    (
        with
            union_cte as (
                select
                    id
                    , name
                from
                    table1
                where
                    name ilike :name_ilike
                union all
                select
                    id
                    , name
                from
                    table2
                where
                    name ilike :name_ilike
            )
        select
            *
        from
            union_cte
    ) as subq`);
        
        // Assert: parameters are correctly extracted
        expect(params).toEqual({ name_ilike: '%test%' });
    });

    test('should inject parameter into column that only exists in UNION CTE', () => {
        // Arrange: parse query where target column only exists in UNION CTE
        const sql = `WITH customers_and_users as (
                SELECT customer_id as search_id, customer_name as search_name FROM customers
                UNION
                SELECT user_id as search_id, user_name as search_name FROM users
            )
            SELECT search_id FROM customers_and_users`;
        const baseQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        
        // Arrange: search for column that only exists in the UNION CTE
        const searchConditions = {
            search_name: { like: '%John%' }
        };
        
        // Act: inject parameters
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, searchConditions);
        
        // Act: format SQL and extract parameters
        const formatter = createFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);
        
        // Assert: parameter is injected into each UNION branch
        expect(formattedSql).toBe(`with
    customers_and_users as (
        select
            customer_id as search_id
            , customer_name as search_name
        from
            customers
        where
            customer_name like :search_name_like
        union
        select
            user_id as search_id
            , user_name as search_name
        from
            users
        where
            user_name like :search_name_like
    )
select
    search_id
from
    customers_and_users`);
        
        // Assert: parameters are correctly extracted
        expect(params).toEqual({ search_name_like: '%John%' });
    });

    test('should handle INTERSECT operation in CTE', () => {
        // Arrange: parse query with INTERSECT in CTE
        const sql = `WITH common_items as (
                SELECT product_id, product_name FROM available_products
                INTERSECT
                SELECT product_id, product_name FROM featured_products
            )
            SELECT * FROM common_items`;
        const baseQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        
        // Arrange: prepare search conditions
        const searchConditions = {
            product_name: { ilike: '%widget%' }
        };
        
        // Act: inject parameters
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, searchConditions);
        
        // Act: format SQL and extract parameters
        const formatter = createFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);
        
        // Assert: parameter is injected into each INTERSECT branch
        expect(formattedSql).toBe(`with
    common_items as (
        select
            product_id
            , product_name
        from
            available_products
        where
            product_name ilike :product_name_ilike
        intersect
        select
            product_id
            , product_name
        from
            featured_products
        where
            product_name ilike :product_name_ilike
    )
select
    *
from
    common_items`);
        
        // Assert: parameters are correctly extracted
        expect(params).toEqual({ product_name_ilike: '%widget%' });
    });

    test('should verify BinarySelectQuery parsing and parameter injection', () => {
        // Arrange: parse query with UNION ALL in CTE
        const sql = `WITH union_cte as (
                SELECT id, name FROM table1
                UNION ALL
                SELECT id, name FROM table2
            )
            SELECT * FROM union_cte`;
        const baseQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        
        // Assert: verify that CTE contains BinarySelectQuery
        expect(baseQuery.withClause).toBeDefined();
        expect(baseQuery.withClause!.tables).toHaveLength(1);
        const cte = baseQuery.withClause!.tables[0];
        expect(cte.query).toBeInstanceOf(BinarySelectQuery);
        const binaryQuery = cte.query as BinarySelectQuery;
        expect(binaryQuery.operator.value).toBe('union all');
        
        // Arrange: prepare search conditions
        const searchConditions = { name: { ilike: '%test%' } };
        
        // Act: inject parameters
        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, searchConditions);
        
        // Act: format SQL and extract parameters
        const formatter = createFormatter();
        const { formattedSql, params } = formatter.format(injectedQuery);
        
        // Assert: parameter is injected into each UNION branch
        expect(formattedSql).toBe(`with
    union_cte as (
        select
            id
            , name
        from
            table1
        where
            name ilike :name_ilike
        union all
        select
            id
            , name
        from
            table2
        where
            name ilike :name_ilike
    )
select
    *
from
    union_cte`);
        expect(params).toEqual({ name_ilike: '%test%' });
    });
});