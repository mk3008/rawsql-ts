import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter - CTE One-liner Feature', () => {
    const sqlWithCTE = `
        WITH user_summary AS (
            SELECT id, name, COUNT(*)
            FROM users
            WHERE active = true
            GROUP BY id, name
        )
        SELECT * FROM user_summary
        ORDER BY name;
    `;

    const sqlWithMultipleCTEs = `
        WITH 
        active_users AS (
            SELECT id, name
            FROM users
            WHERE active = true
        ),
        user_orders AS (
            SELECT user_id, COUNT(*) as order_count
            FROM orders
            GROUP BY user_id
        )
        SELECT u.id, u.name, o.order_count
        FROM active_users u
        LEFT JOIN user_orders o ON u.id = o.user_id
        ORDER BY u.name;
    `;

    test('should format CTE as one-liner when cteOneline is true', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            cteOneline: true
        });
        
        // Expected: Complete SQL with formatting rules applied
        const expectedSql = `with
  "user_summary" as (select "id", "name", count(*) from "users" where "active" = true group by "id", "name")
select
  *
from
  "user_summary"
order by
  "name"`;

        // Act: Execute the test target
        const result = formatter.format(query);
        
        // Assert: Verify the result
        expect(result.formattedSql).toBe(expectedSql);
    });

    test('should format CTE normally when cteOneline is false or not specified', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            cteOneline: false
        });
        
        // Expected: Complete SQL with formatting rules applied
        const expectedSql = `with
  "user_summary" as (
    select
      "id", "name", count(*)
    from
      "users"
    where
      "active" = true
    group by
      "id", "name"
  )
select
  *
from
  "user_summary"
order by
  "name"`;

        // Act: Execute the test target
        const result = formatter.format(query);
        
        // Assert: Verify the result
        expect(result.formattedSql).toBe(expectedSql);
    });

    test('should format multiple CTEs as one-liners when cteOneline is true', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithMultipleCTEs);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            cteOneline: true
        });
        
        // Expected: Complete SQL with formatting rules applied
        const expectedSql = `with
  "active_users" as (select "id", "name" from "users" where "active" = true),
  "user_orders" as (select "user_id", count(*) as "order_count" from "orders" group by "user_id")
select
  "u"."id", "u"."name", "o"."order_count"
from
  "active_users" as "u"
  left join "user_orders" as "o" on "u"."id" = "o"."user_id"
order by
  "u"."name"`;

        // Act: Execute the test target
        const result = formatter.format(query);
        
        // Assert: Verify the result
        expect(result.formattedSql).toBe(expectedSql);
    });

    test('should preserve keyword case in CTE one-liner formatting', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'upper',
            cteOneline: true
        });
        
        // Expected: Complete SQL with formatting rules applied
        const expectedSql = `WITH
  "user_summary" AS (SELECT "id", "name", count(*) FROM "users" WHERE "active" = true GROUP BY "id", "name")
SELECT
  *
FROM
  "user_summary"
ORDER BY
  "name"`;

        // Act: Execute the test target
        const result = formatter.format(query);
        
        // Assert: Verify the result
        expect(result.formattedSql).toBe(expectedSql);
    });

    test('should handle nested CTEs correctly', () => {
        // Arrange: Set up test data and conditions
        const nestedCTESQL = `
            WITH inner_cte AS (
                SELECT * FROM base_table
            ),
            outer_cte AS (
                SELECT id, name FROM inner_cte WHERE active = true
            )
            SELECT * FROM outer_cte;
        `;

        const query = SelectQueryParser.parse(nestedCTESQL);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            cteOneline: true
        });
        
        // Expected: Complete SQL with formatting rules applied
        const expectedSql = `with
  "inner_cte" as (select * from "base_table"),
  "outer_cte" as (select "id", "name" from "inner_cte" where "active" = true)
select
  *
from
  "outer_cte"`;

        // Act: Execute the test target
        const result = formatter.format(query);
        
        // Assert: Verify the result
        expect(result.formattedSql).toBe(expectedSql);
    });

    test('should handle comments in CTE when cteOneline is true', () => {
        // Arrange: Set up test data and conditions
        const cteWithComments = `
            WITH user_summary AS (
                -- Get active users
                SELECT id, name, COUNT(*)
                FROM users
                WHERE active = true
                GROUP BY id, name
            )
            SELECT * FROM user_summary;
        `;

        const query = SelectQueryParser.parse(cteWithComments);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            cteOneline: true,
            exportComment: true
        });
        
        // Expected: Complete SQL with formatting rules applied
        const expectedSql = `with
  "user_summary" as (/* Get active users */ select "id", "name", count(*) from "users" where "active" = true group by "id", "name")
select
  *
from
  "user_summary"`;

        // Act: Execute the test target
        const result = formatter.format(query);
        
        // Assert: Verify the result
        expect(result.formattedSql).toBe(expectedSql);
    });

    test('should maintain backward compatibility when cteOneline is not specified', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' '
        });
        
        // Expected: Complete SQL with formatting rules applied
        const expectedSql = `with
  "user_summary" as (
    select
      "id", "name", count(*)
    from
      "users"
    where
      "active" = true
    group by
      "id", "name"
  )
select
  *
from
  "user_summary"
order by
  "name"`;

        // Act: Execute the test target
        const result = formatter.format(query);
        
        // Assert: Verify the result
        expect(result.formattedSql).toBe(expectedSql);
    });
});