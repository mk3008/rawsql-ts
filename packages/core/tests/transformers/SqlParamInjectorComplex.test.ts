import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';

/**
 * Demonstrates injection of parameters into complex queries,
 * including CTEs and nested subqueries.
 */
describe('SqlParamInjector complex scenarios', () => {
    test('injects into both CTE and nested subquery', () => {
        const sql = `
      WITH cte_users AS (
        SELECT id, name FROM users WHERE active = true
      )
      SELECT * FROM (
        SELECT id AS user_id, name AS user_name FROM cte_users
      ) AS sub
    `;
        const baseQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const state = { id: 42, name: 'Alice' };

        const injector = new SqlParamInjector();
        const injectedQuery = injector.inject(baseQuery, state);

        const formatter = new SqlFormatter({
            parameterSymbol: ":",
            parameterStyle: "named",
            indentSize: 4,
            indentChar: " ",
            newline: "\n",
            keywordCase: "lower",
            commaBreak: "before",
            andBreak: "before"
        });
        const { formattedSql, params } = formatter.format(injectedQuery);

        // The formatted SQL should be pretty-printed with indentation, comma breaks, and AND breaks
        expect(formattedSql).toEqual(`with
    "cte_users" as (
        select
            "id"
            , "name"
        from
            "users"
        where
            "active" = true
            and "id" = :id
            and "name" = :name
    )
select
    *
from
    (
        select
            "id" as "user_id"
            , "name" as "user_name"
        from
            "cte_users"
    ) as "sub"`);
        // Params should include both values
        expect(params).toEqual({ id: 42, name: 'Alice' });
    });
  
  test('injects alias and name parameters correctly', () => {
    const sql = `
      WITH cte_users AS (
        SELECT id, name FROM users WHERE active = true
      )
      SELECT * FROM (
        SELECT id AS user_id, name AS user_name FROM cte_users
      ) AS sub
    `;
    const baseQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
    const state = { user_id: 42, name: 'Alice' };

    const injector = new SqlParamInjector();
    const injectedQuery = injector.inject(baseQuery, state);

    const formatter = new SqlFormatter({
        parameterSymbol: ":",
        parameterStyle: "named",
        indentSize: 4,
        indentChar: " ",
        newline: "\n",
        keywordCase: "lower",
        commaBreak: "before",
        andBreak: "before"
    });
    const { formattedSql, params } = formatter.format(injectedQuery);

    // Full formatted SQL should match expected structure
    expect(formattedSql).toEqual(`with
    "cte_users" as (
        select
            "id"
            , "name"
        from
            "users"
        where
            "active" = true
            and "name" = :name
    )
select
    *
from
    (
        select
            "id" as "user_id"
            , "name" as "user_name"
        from
            "cte_users"
        where
            "id" = :user_id
    ) as "sub"`);
    expect(params).toEqual({ user_id: 42, name: 'Alice' });
  });
});
