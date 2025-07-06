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
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            cteOneline: true
        });

        const result = formatter.format(query);
        
        // Check that the CTE part is formatted as one-liner
        expect(result.formattedSql).toContain('(select "id", "name", count(*) from "users" where "active" = true group by "id", "name")');
        
        // Check that the main query still uses normal formatting
        expect(result.formattedSql).toContain('select\n  *\nfrom\n  "user_summary"');
    });

    test('should format CTE normally when cteOneline is false or not specified', () => {
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            cteOneline: false
        });

        const result = formatter.format(query);
        
        // Check that the CTE part is formatted with normal indentation
        expect(result.formattedSql).toContain('(\n    select\n      "id", "name", count(*)');
        
        // Check that formatting is consistent
        expect(result.formattedSql).toContain('where\n      "active" = true');
    });

    test('should format multiple CTEs as one-liners when cteOneline is true', () => {
        const query = SelectQueryParser.parse(sqlWithMultipleCTEs);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            cteOneline: true
        });

        const result = formatter.format(query);
        
        // Check that both CTEs are formatted as one-liners
        expect(result.formattedSql).toContain('(select "id", "name" from "users" where "active" = true)');
        expect(result.formattedSql).toContain('(select "user_id", count(*) as "order_count" from "orders" group by "user_id")');
        
        // Check that the main query still uses normal formatting
        expect(result.formattedSql).toContain('select\n  "u"."id", "u"."name", "o"."order_count"');
    });

    test('should preserve keyword case in CTE one-liner formatting', () => {
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'upper',
            cteOneline: true
        });

        const result = formatter.format(query);
        
        // Check that CTE uses uppercase keywords (note: function names and boolean values might not be converted)
        expect(result.formattedSql).toContain('(SELECT "id", "name", count(*) FROM "users" WHERE "active" = true GROUP BY "id", "name")');
        
        // Check that main query also uses uppercase keywords
        expect(result.formattedSql).toContain('SELECT\n  *\nFROM\n  "user_summary"');
    });

    test('should handle nested CTEs correctly', () => {
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

        const result = formatter.format(query);
        
        // Check that both CTEs are formatted as one-liners
        expect(result.formattedSql).toContain('(select * from "base_table")');
        expect(result.formattedSql).toContain('(select "id", "name" from "inner_cte" where "active" = true)');
    });

    test('should handle comments in CTE when cteOneline is true', () => {
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

        const result = formatter.format(query);
        
        // Check that the CTE is still formatted as one-liner even with comments
        expect(result.formattedSql).toContain('(/* Get active users */ select "id", "name", count(*) from "users" where "active" = true group by "id", "name")');
    });

    test('should maintain backward compatibility when cteOneline is not specified', () => {
        const query = SelectQueryParser.parse(sqlWithCTE);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' '
        });

        const result = formatter.format(query);
        
        // Should format normally without one-liner
        expect(result.formattedSql).toContain('(\n    select\n      "id", "name", count(*)');
        expect(result.formattedSql).not.toContain('(select "id", "name", count(*) from "users"');
    });
});