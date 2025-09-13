import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter - WITH Clause Style Feature', () => {
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

    test('should use standard formatting when withClauseStyle is "standard"', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            withClauseStyle: 'standard'
        });
        
        // Expected: Default formatting behavior
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

    test('should format CTEs individually when withClauseStyle is "cte-oneline"', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            withClauseStyle: 'cte-oneline'
        });
        
        // Expected: Individual CTEs are one-liners but WITH structure is preserved
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

    test('should format entire WITH clause as one-liner when withClauseStyle is "full-oneline"', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            withClauseStyle: 'full-oneline'
        });
        
        // Expected: WITH clause content completely on one line, followed by normal formatted SELECT
        const expectedSql = `with "user_summary" as (select "id", "name", count(*) from "users" where "active" = true group by "id", "name")
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

    test('should format multiple CTEs on one line when withClauseStyle is "full-oneline"', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithMultipleCTEs);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            withClauseStyle: 'full-oneline'
        });
        
        // Expected: WITH clause content completely on one line, followed by normal formatted SELECT
        const expectedSql = `with "active_users" as (select "id", "name" from "users" where "active" = true), "user_orders" as (select "user_id", count(*) as "order_count" from "orders" group by "user_id")
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

    test('should preserve keyword case in WITH one-liner formatting', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'upper',
            withClauseStyle: 'full-oneline'
        });
        
        // Expected: WITH clause content completely on one line with keywords in uppercase, followed by normal formatted SELECT
        const expectedSql = `WITH "user_summary" AS (SELECT "id", "name", count(*) FROM "users" WHERE "active" = true GROUP BY "id", "name")
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

    test('should handle comments in WITH clause when withClauseStyle is "full-oneline"', () => {
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
            withClauseStyle: 'full-oneline',
            exportComment: true
        });
        
        // Expected: WITH clause content completely on one line with current positioned comments system
        // Note: CTE inner comments not captured by current positioned comments system
        const expectedSql = `with "user_summary" as (select "id", "name", count(*) from "users" where "active" = true group by "id", "name")
select
  *
from
  "user_summary"`;

        // Act: Execute the test target
        const result = formatter.format(query);
        
        // Assert: Verify the result
        expect(result.formattedSql).toBe(expectedSql);
    });

    test('should maintain backward compatibility when withClauseStyle is not specified', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' '
        });
        
        // Expected: Default formatting behavior (same as 'standard')
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

    test('should handle multiple CTEs with cte-oneline style', () => {
        // Arrange: Set up test data and conditions
        const query = SelectQueryParser.parse(sqlWithMultipleCTEs);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            withClauseStyle: 'cte-oneline'
        });
        
        // Expected: Individual CTEs are one-liners but WITH structure is preserved
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
});