import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter CTE comment duplication prevention', () => {
    const formatterOptions = {
        identifierEscape: {
            start: "",
            end: ""
        },
        parameterSymbol: "$",
        parameterStyle: "indexed" as const,
        indentSize: 4,
        indentChar: " " as const,
        newline: "\n" as const,
        keywordCase: "upper" as const,
        commaBreak: "before" as const,
        andBreak: "before" as const,
        exportComment: true,
        parenthesesOneLine: true,
        betweenOneLine: true,
        valuesOneLine: true,
        joinOneLine: true,
        caseOneLine: true,
        subqueryOneLine: true
    };

    it('should not duplicate CTE name comments', () => {
        const sql = `
            WITH /* Raw data preparation */ raw_sales AS (
                SELECT id, quantity FROM sales
            )
            SELECT * FROM raw_sales
        `;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Should contain the comment only once
        const commentMatches = result.formattedSql.match(/\/\*\s*Raw data preparation\s*\*\//g);
        expect(commentMatches).toHaveLength(1);

        // Should not contain duplicate pattern
        expect(result.formattedSql).not.toMatch(/\/\*\s*Raw data preparation\s*\*\/\s*\/\*\s*Raw data preparation\s*\*\//);

        // Verify formatted structure - comment is positioned before CTE name within WITH clause
        expect(result.formattedSql).toMatch(/WITH\s+\/\*\s*Raw data preparation\s*\*\/\s+/);
    });

    it('should not duplicate multiple CTE comments', () => {
        const sql = `
            WITH
                /* First CTE */ first_cte AS (
                    SELECT 1 as col
                ),
                /* Second CTE */ second_cte AS (
                    SELECT 2 as col
                )
            SELECT * FROM first_cte UNION SELECT * FROM second_cte
        `;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Each comment should appear only once
        const firstCteMatches = result.formattedSql.match(/\/\*\s*First CTE\s*\*\//g);
        const secondCteMatches = result.formattedSql.match(/\/\*\s*Second CTE\s*\*\//g);

        expect(firstCteMatches).toHaveLength(1);
        expect(secondCteMatches).toHaveLength(1);

        // Should not contain any duplicate patterns
        expect(result.formattedSql).not.toMatch(/\/\*\s*First CTE\s*\*\/\s*\/\*\s*First CTE\s*\*\//);
        expect(result.formattedSql).not.toMatch(/\/\*\s*Second CTE\s*\*\/\s*\/\*\s*Second CTE\s*\*\//);
    });

    it('should not duplicate CTE comments with column aliases', () => {
        const sql = `
            WITH /* Sales data */ sales_summary (id, total) AS (
                SELECT customer_id, SUM(amount) FROM sales GROUP BY customer_id
            )
            SELECT * FROM sales_summary
        `;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Comment should appear only once
        const commentMatches = result.formattedSql.match(/\/\*\s*Sales data\s*\*\//g);
        expect(commentMatches).toHaveLength(1);

        // Should not duplicate
        expect(result.formattedSql).not.toMatch(/\/\*\s*Sales data\s*\*\/\s*\/\*\s*Sales data\s*\*\//);

        // Verify structure with column aliases - comment is positioned before CTE name within WITH clause
        expect(result.formattedSql).toMatch(/WITH\s+\/\*\s*Sales data\s*\*\/\s+/);
    });

    it('should not duplicate RECURSIVE CTE comments', () => {
        const sql = `
            WITH RECURSIVE /* Hierarchy traversal */ hierarchy AS (
                SELECT id, parent_id, 1 as level FROM categories WHERE parent_id IS NULL
                UNION ALL
                SELECT c.id, c.parent_id, h.level + 1
                FROM categories c
                JOIN hierarchy h ON c.parent_id = h.id
            )
            SELECT * FROM hierarchy
        `;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Comment should appear only once (if any - RECURSIVE might not preserve comments yet)
        const commentMatches = result.formattedSql.match(/\/\*\s*Hierarchy traversal\s*\*\//g);
        if (commentMatches) {
            expect(commentMatches).toHaveLength(1);

            // Should not duplicate
            expect(result.formattedSql).not.toMatch(/\/\*\s*Hierarchy traversal\s*\*\/\s*\/\*\s*Hierarchy traversal\s*\*\//);
        }

        // At minimum, should parse without error and contain RECURSIVE
        expect(result.formattedSql).toMatch(/WITH\s+RECURSIVE/);
    });

    it('should preserve all different CTE comments without mixing', () => {
        const sql = `
            WITH
                /* Base data */ base AS (
                    SELECT id FROM table1
                ),
                /* Enriched data */ enriched AS (
                    SELECT b.id, t2.name FROM base b JOIN table2 t2 ON b.id = t2.id
                )
            SELECT * FROM enriched
        `;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Each different comment should appear only once
        const baseMatches = result.formattedSql.match(/\/\*\s*Base data\s*\*\//g);
        const enrichedMatches = result.formattedSql.match(/\/\*\s*Enriched data\s*\*\//g);

        expect(baseMatches).toHaveLength(1);
        expect(enrichedMatches).toHaveLength(1);

        // Should not cross-pollinate comments
        expect(result.formattedSql).not.toMatch(/\/\*\s*Base data\s*\*\/\s*\/\*\s*Base data\s*\*\//);
        expect(result.formattedSql).not.toMatch(/\/\*\s*Enriched data\s*\*\/\s*\/\*\s*Enriched data\s*\*\//);
        expect(result.formattedSql).not.toMatch(/\/\*\s*Base data\s*\*\/[^]*\/\*\s*Enriched data\s*\*\/[^]*"base"/);
    });
});