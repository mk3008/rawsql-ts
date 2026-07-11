import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlPrintToken, SqlPrintTokenContainerType, SqlPrintTokenType } from '../../src/models/SqlPrintToken';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SqlPrinter } from '../../src/transformers/SqlPrinter';

/**
 * CommentStyle - Comprehensive TDD Test
 *
 * Tests the smart comment style feature that converts single-line comments to line comments
 * while merging multi-line content into block structures.
 */
describe('CommentStyle - Comprehensive TDD Test', () => {
    const blockFormatter = new SqlFormatter({
        exportComment: true,
        commentStyle: 'block',
        keywordCase: 'upper',
        newline: '\n'
    });

    const smartFormatter = new SqlFormatter({
        exportComment: true,
        commentStyle: 'smart',
        keywordCase: 'upper',
        newline: '\n'
    });

    describe('Block style (default)', () => {
        test('should preserve all comments as individual blocks', () => {
            // Arrange
            const sql = `
                /* Header comment */
                SELECT s.sale_id /* Field comment */, s.amount
                FROM sales s /* Table comment */
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = blockFormatter.format(query);

            // Assert - block style preserves original format
            expect(result.formattedSql).toContain('/* Header comment */');
            expect(result.formattedSql).toContain('/* Field comment */');
            expect(result.formattedSql).toContain('/* Table comment */');
        });

        test('should keep comma-prefixed CASE select item comments aligned with the select item', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select a
                , /* explains case */
                case when b is null then 0 else 1 end as b_flag
                from t
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql).toContain([
                '    , /* explains case */',
                '    case'
            ].join('\n'));
            expect(result.formattedSql).not.toContain([
                '    ,',
                '        /* explains case */',
                '    case'
            ].join('\n'));
        });

        test('should keep comma-prefixed select item comments on the comma line', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select a
                , /* explains count */
                count(*) as n
                , /* explains b */
                b
                from t
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql).toContain([
                '    , /* explains count */',
                '    count(*) as "n"',
            ].join('\n'));
            expect(result.formattedSql).toContain([
                '    , /* explains b */',
                '    "b"',
            ].join('\n'));
            expect(result.formattedSql).not.toContain([
                '    ,',
                '    /* explains count */',
            ].join('\n'));
            expect(result.formattedSql).not.toContain([
                '    ,',
                '    /* explains b */',
            ].join('\n'));
        });

        test('should keep comma-suffixed select item comments on a dedicated line', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'after',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select a,
                /* explains count */
                count(*) as n,
                /* explains b */
                b
                from t
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql).toContain([
                '    "a",',
                '    /* explains count */',
                '    count(*) as "n",',
                '    /* explains b */',
                '    "b"',
            ].join('\n'));
            expect(result.formattedSql).not.toContain('/* explains count */ count(*)');
            expect(result.formattedSql).not.toContain('/* explains b */ "b"');
        });

        test('should not duplicate comma-prefixed comments in function arguments', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select concat(a
                , /* second arg */
                b
                , /* third arg */
                c) as label
                from t
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql.match(/second arg/g)).toHaveLength(1);
            expect(result.formattedSql.match(/third arg/g)).toHaveLength(1);
        });

        test('should not duplicate comma-prefixed comments in ORDER BY and GROUP BY lists', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select a, b, count(*) as n
                from t
                group by a
                , /* second grouping item */
                b
                order by a
                , /* secondary sort item */
                b desc
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql.match(/second grouping item/g)).toHaveLength(1);
            expect(result.formattedSql.match(/secondary sort item/g)).toHaveLength(1);
        });

        test('should keep comma-prefixed ORDER BY and GROUP BY comments on the comma line', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select a, b, count(*) as n
                from t
                group by a
                , /* second grouping item */
                b
                order by a
                , /* secondary sort item */
                b desc
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql).toContain([
                'group by',
                '    "a"',
                '    , /* second grouping item */',
                '    "b"',
            ].join('\n'));
            expect(result.formattedSql).toContain([
                'order by',
                '    "a"',
                '    , /* secondary sort item */',
                '    "b" desc',
            ].join('\n'));
            expect(result.formattedSql).not.toContain([
                '    ,',
                '    /* second grouping item */',
            ].join('\n'));
            expect(result.formattedSql).not.toContain([
                '    ,',
                '    /* secondary sort item */',
            ].join('\n'));
        });

        test('should keep comma-suffixed ORDER BY and GROUP BY comments on dedicated lines', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'after',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select a, b, count(*) as n
                from t
                group by a,
                /* second grouping item */
                b
                order by a,
                /* secondary sort item */
                b desc
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql).toContain([
                'group by',
                '    "a",',
                '    /* second grouping item */',
                '    "b"',
            ].join('\n'));
            expect(result.formattedSql).toContain([
                'order by',
                '    "a",',
                '    /* secondary sort item */',
                '    "b" desc',
            ].join('\n'));
            expect(result.formattedSql).not.toContain('/* second grouping item */ "b"');
            expect(result.formattedSql).not.toContain('/* secondary sort item */ "b"');
        });

        test('should keep ORDER BY direction comments adjacent to the ordered expression', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select *
                from t
                order by
                    /* demo fixed order */
                    customer_rank desc
                    , last_ordered_at desc nulls last -- recent buyer first
                    , created_at asc
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql.match(/recent buyer first/g)).toHaveLength(1);
            expect(result.formattedSql.match(/demo fixed order/g)).toHaveLength(1);
            expect(result.formattedSql).toContain('    /* demo fixed order */');
            expect(result.formattedSql).toContain('    , "last_ordered_at" desc nulls last /* recent buyer first */');
        });

        test('should keep window ORDER BY direction comments consistent with PARTITION BY comments', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select
                    row_number() over (
                        partition by l.user_id -- user scope
                        order by l.logged_in_at desc /* latest first */
                    ) as rn
                from login_logs l
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql.match(/latest first/g)).toHaveLength(1);
            expect(result.formattedSql).toContain([
                '        partition by',
                '            "l"."user_id" /* user scope */',
                '        order by',
                '            "l"."logged_in_at" desc /* latest first */',
            ].join('\n'));
            expect(result.formattedSql).not.toContain([
                '        order by',
                '            /* latest first */',
                '            "l"."logged_in_at" desc',
            ].join('\n'));
        });

        test('should not move or duplicate comments inside parenthesized WHERE predicates', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select *
                from t
                where (
                    /* email match */
                    email = :keyword
                    or /* name match */
                    name = :keyword
                )
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql.match(/email match/g)).toHaveLength(1);
            expect(result.formattedSql.match(/name match/g)).toHaveLength(1);
            expect(result.formattedSql).not.toContain(') /* email match */');
        });

        test('should preserve comments before LIMIT and OFFSET values', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select *
                from t
                order by id
                limit /* page size */
                :limit
                offset /* page offset */
                :offset
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql.match(/page size/g)).toHaveLength(1);
            expect(result.formattedSql.match(/page offset/g)).toHaveLength(1);
            expect(result.formattedSql).toMatch(/limit\s+\/\* page size \*\/\s+:limit/);
            expect(result.formattedSql).toMatch(/offset\s+\/\* page offset \*\/\s+:offset/);
        });

        test('should preserve comments after HAVING and JOIN ON keywords', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n',
                joinOneLine: false
            });
            const sql = `
                select c.customer_id, count(*) as ticket_count
                from customers c
                join tickets t on /* join key */ t.customer_id = c.customer_id
                group by c.customer_id
                having /* minimum tickets */ count(*) > 0
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql).toContain('/* join key */');
            expect(result.formattedSql).toContain('/* minimum tickets */');
        });

        test('should expand function arguments only when an argument has a comment', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'after',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });

            const compactQuery = SelectQueryParser.parse(`
                select concat(a, b, c) as label
                from t
            `).toSimpleQuery();
            const commentedQuery = SelectQueryParser.parse(`
                select concat(a, /* arg b */ b, c) as label
                from t
            `).toSimpleQuery();

            const compactResult = formatter.format(compactQuery);
            const commentedResult = formatter.format(commentedQuery);

            expect(compactResult.formattedSql).toContain('concat("a", "b", "c") as "label"');
            expect(commentedResult.formattedSql).toContain([
                '    concat(',
                '        "a",',
                '        /* arg b */',
                '        "b",',
                '        "c"',
                '    ) as "label"',
            ].join('\n'));
        });

        test('should reject non-logical print tokens before scanning comment descendants', () => {
            const printer = new SqlPrinter();
            const printerInternals = printer as unknown as {
                isLogicalOperatorWithComment(token: SqlPrintToken): boolean;
            };
            const nonLogicalTokens = [
                new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.BinaryExpression),
                new SqlPrintToken(SqlPrintTokenType.operator, '+'),
            ];

            for (const token of nonLogicalTokens) {
                Object.defineProperty(token, 'innerTokens', {
                    get: () => {
                        throw new Error('non-logical token descendants must not be scanned');
                    },
                });

                expect(printerInternals.isLogicalOperatorWithComment(token)).toBe(false);
            }
        });

        test('should indent predicates after AND and OR comments', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                andBreak: 'before',
                orBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });
            const sql = `
                select *
                from t
                where status = 'open'
                  and /* tenant */ tenant_id = 1
                  or /* urgent */ priority = 'high'
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql).toContain([
                'where',
                '    "status" = \'open\'',
                '    and /* tenant */',
                '        "tenant_id" = 1',
                '    or /* urgent */',
                '        "priority" = \'high\'',
            ].join('\n'));
        });

        test('should not duplicate comments before CASE select items', () => {
            const formatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'block',
                commaBreak: 'before',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n',
                caseOneLine: false
            });
            const sql = `
                select
                    case
                        /* rank */
                        when a = 1 then 'x'
                        else 'y'
                    end as rank
                from t
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            const result = formatter.format(query);

            expect(result.formattedSql.match(/rank/g)).toHaveLength(2);
            expect(result.formattedSql).toContain([
                '    case',
                '        /* rank */',
                '        when "a" = 1 then',
            ].join('\n'));
            expect(result.formattedSql).not.toContain('    /* rank */\n    case');
            expect(result.formattedSql).not.toContain('end /* rank */ as "rank"');
        });
    });

    describe('Smart style conversion', () => {
        test('should convert single comments to line format', () => {
            // Arrange
            const sql = `
                SELECT s.sale_id /* Single comment */, s.amount
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - smart style converts single comments to line format
            expect(result.formattedSql).toContain('-- Single comment');
            expect(result.formattedSql).not.toContain('/* Single comment */');
        });

        test('should merge consecutive block comments into multi-line format', () => {
            // Arrange - Create a SQL with header comments that will be split by parser
            const sql = `
                /*
                  Sales Analysis Report - Q4 2023
                  ================================

                  Purpose: Comprehensive analysis
                  Author: Analytics Team
                */
                SELECT 1
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - smart style should create multi-line block comment
            expect(result.formattedSql).toContain('/*\n');
            expect(result.formattedSql).toContain('Sales Analysis Report');
            expect(result.formattedSql).toContain('================================');
            expect(result.formattedSql).toContain('Purpose: Comprehensive analysis');
            expect(result.formattedSql).toContain('Author: Analytics Team');
            expect(result.formattedSql).toMatch(/\n\s*\*\//);
        });

        test('should merge stacked line comments into block format', () => {
            // Arrange
            const sql = `
                WITH
                    -- Header line 1
                    -- Header line 2
                    sample AS (
                        SELECT 1
                    )
                SELECT * FROM sample
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - multi-line comment block is produced
            expect(result.formattedSql).toContain('/*\n');
            expect(result.formattedSql).toContain('Header line 1');
            expect(result.formattedSql).toContain('Header line 2');
            expect(result.formattedSql).toMatch(/\n\s*\*\//);
        });

        test('should preserve existing line comments unchanged', () => {
            // Arrange - Note: Parser converts inline -- comments to block format
            const sql = `
                SELECT s.sale_id, -- Line comment
                       s.amount
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - Line comment content should be preserved (even if converted to block format)
            expect(result.formattedSql).toContain('Line comment');
        });

        test('should preserve empty block comments without escaping delimiters', () => {
            const commentBlock = new SqlPrintToken(
                SqlPrintTokenType.container,
                '',
                SqlPrintTokenContainerType.CommentBlock
            );
            commentBlock.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.comment, '/**/'));

            const printer = new SqlPrinter({
                exportComment: true,
                commentStyle: 'smart',
                indentSize: 4,
                indentChar: ' ',
                keywordCase: 'lower',
                newline: '\n'
            });

            const result = printer.print(commentBlock);

            expect(result).toBe('/**/');
            expect(result).not.toContain('\\/');
        });
    });

    describe('Smart style with comma break integration', () => {
        test('should work correctly with after comma style', () => {
            // Arrange
            const afterCommaSmartFormatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'smart',
                commaBreak: 'after',
                keywordCase: 'upper',
                newline: '\n'
            });

            const sql = `
                SELECT s.sale_id /* Sale ID */, s.amount /* Amount */
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = afterCommaSmartFormatter.format(query);

            // Assert - smart style works with comma breaks and line comments
            expect(result.formattedSql).toContain('-- Sale ID');
            expect(result.formattedSql).toContain('-- Amount');
            expect(result.formattedSql).toContain(',\n'); // After comma style
        });

        test('should work correctly with before comma style', () => {
            // Arrange
            const beforeCommaSmartFormatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'smart',
                commaBreak: 'before',
                keywordCase: 'upper',
                newline: '\n'
            });

            const sql = `
                SELECT s.sale_id /* Sale ID */, s.amount /* Amount */
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = beforeCommaSmartFormatter.format(query);

            // Assert - smart style works with comma breaks and line comments
            expect(result.formattedSql).toContain('-- Sale ID');
            expect(result.formattedSql).toContain('-- Amount');
            expect(result.formattedSql).toContain('\n,'); // Before comma style
        });

        test('should preserve comma placement after inline comments when using after style', () => {
            // Arrange
            const afterCommaSmartFormatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'smart',
                commaBreak: 'after',
                keywordCase: 'upper',
                newline: '\n'
            });

            const sql = `
                SELECT
                    "c"."customer_id" /* Identifier */,
                    "c"."customer_name" /* Customer name */,
                    "c"."region" /* Region */,
                    "c"."status"
                FROM customers c
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = afterCommaSmartFormatter.format(query);

            // Assert - comments stay attached to expressions and commas move to following lines
            expect(result.formattedSql).toMatch(/"c"\."customer_id" -- Identifier\n,\n/);
            expect(result.formattedSql).toMatch(/"c"\."customer_name" -- Customer name\n,\n/);
            expect(result.formattedSql).toMatch(/"c"\."region" -- Region\n,\n/);
        });

        test('should keep commas executable when comma break is none', () => {
            // Arrange
            const noneCommaFormatter = new SqlFormatter({
                exportComment: true,
                commentStyle: 'smart',
                commaBreak: 'none',
                keywordCase: 'upper',
                newline: '\n'
            });

            const sql = `
                SELECT
                    o.order_id /* Order identifier */,
                    o.customer_id /* Customer identifier */
                FROM orders o
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = noneCommaFormatter.format(query);

            // Assert - commas should remain outside the line comments
            expect(result.formattedSql).toContain(', "o"."customer_id" -- Customer identifier');
            expect(result.formattedSql).not.toContain('-- Order identifier,');
            expect(result.formattedSql).not.toContain('-- Customer identifier,');
        });
    });

    describe('Edge cases', () => {
        test('should insert newline after line comments that precede expressions', () => {
            // Arrange
            const sql = `
                SELECT
                    /* Net amount calculation */ "s"."quantity" * "s"."unit_price" * (1 - "s"."discount_rate") AS net_amount
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();
            // Act
            const result = smartFormatter.format(query);

            // Assert - expression should move to the next line
            expect(result.formattedSql).toContain('-- Net amount calculation\n');
            expect(result.formattedSql).toMatch(/\n\s*"s"\."quantity" \* "s"\."unit_price"/);
        });

        test('should handle empty comments gracefully', () => {
            // Arrange
            const sql = `
                SELECT s.sale_id /**/, s.amount /* */
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - should handle empty comments without errors
            expect(result.formattedSql).toContain('SELECT');
            expect(result.formattedSql).toContain('FROM');
        });

        test('should retain inline arithmetic comments inside expressions', () => {
            // Arrange
            const sql = `
                SELECT /* a */ 1 + /* b */ 2 AS result
                FROM dual_table
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - comments should stay attached to their operands in order
            expect(result.formattedSql).toMatch(/-- a\n\s*1 \+ -- b\n\s*2 AS "result"/);
        });

        test('should escape block delimiters when merging stacked line comments', () => {
            // Arrange
            const sql = `
                SELECT
                    -- /* */
                    -- /* */
                    a.id
                FROM accounts a
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - each comment line should contain escaped block markers
            const escapedLines = result.formattedSql
                .split('\n')
                .filter(line => line.startsWith('--'));
            expect(escapedLines).toEqual(['-- \\/\\* *\\/', '-- \\/\\* *\\/']);
        });

        test('should preserve comment content with special characters', () => {
            // Arrange - Use simpler comment to avoid parser issues
            const sql = `
                SELECT s.sale_id /* Comment with special chars: @#$%^&*() */, s.amount
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - should preserve special characters in comments
            expect(result.formattedSql).toContain('Comment with special chars');
            expect(result.formattedSql).toContain('@#$%^&*()');
        });

        test('should handle queries without comments', () => {
            // Arrange
            const sql = `
                SELECT s.sale_id, s.amount
                FROM sales s
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const result = smartFormatter.format(query);

            // Assert - should work normally without comments
            expect(result.formattedSql).toContain('SELECT');
            expect(result.formattedSql).toContain('FROM');
            expect(result.formattedSql).not.toContain('/*');
            expect(result.formattedSql).not.toContain('--');
        });
    });

    describe('Comparison with block style', () => {
        test('should demonstrate difference between block and smart styles', () => {
            // Arrange - Use a complex SQL with header comments
            const sql = `
                /*
                  Complex Query Header
                  ===================

                  This is a multi-line header comment
                  that demonstrates the difference
                */
                SELECT s.sale_id /* Field comment */
                FROM sales s /* Table comment */
            `;

            const query = SelectQueryParser.parse(sql).toSimpleQuery();

            // Act
            const blockResult = blockFormatter.format(query);
            const smartResult = smartFormatter.format(query);

            // Assert - smart style should have fewer comment blocks but same content
            expect(blockResult.formattedSql).toContain('/*');
            expect(smartResult.formattedSql).toContain('/*');

            // Both should contain the same content
            expect(blockResult.formattedSql).toContain('Complex Query Header');
            expect(smartResult.formattedSql).toContain('Complex Query Header');
            expect(blockResult.formattedSql).toContain('Field comment');
            expect(smartResult.formattedSql).toContain('Field comment');

            // Smart style should create multi-line structure for header
            expect(smartResult.formattedSql).toContain('/*\n');
            expect(smartResult.formattedSql).toContain('\n*/');
        });
    });
});
