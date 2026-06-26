import { describe, expect, test } from "vitest";
import {
    AstCommentAttachment,
    extractAstCommentAttachments,
    SelectItem,
    SelectQueryParser,
    SqlFormatter
} from "../../src";

function texts(attachments: AstCommentAttachment[]): string[] {
    return attachments.map((attachment) => attachment.text);
}

describe("AstCommentAttachmentExtractor", () => {
    test("extracts query header comments in source order", () => {
        const query = SelectQueryParser.parse(`
            -- query header one
            -- query header two
            SELECT id FROM users
        `);

        const attachments = extractAstCommentAttachments(query);

        expect(texts(attachments).slice(0, 2)).toEqual([
            "query header one",
            "query header two"
        ]);
        expect(attachments[0]).toMatchObject({
            text: "query header one",
            sourceOrder: 0,
            placement: "leading",
            targetNode: query
        });
        expect(attachments[1]).toMatchObject({
            text: "query header two",
            sourceOrder: 1,
            placement: "leading",
            targetNode: query
        });
    });

    test("extracts CTE leading comments without assigning product meaning", () => {
        const query = SelectQueryParser.parse(`
            -- query header
            WITH
            -- first cte leading
            raw_sales AS (
                -- inner query header
                SELECT id FROM sales
            ),
            -- second cte leading
            summarized AS (
                SELECT id FROM raw_sales
            )
            SELECT id FROM summarized
        `).toSimpleQuery();

        const attachments = extractAstCommentAttachments(query);

        expect(texts(attachments).slice(0, 5)).toEqual([
            "query header",
            "first cte leading",
            "inner query header",
            "second cte leading"
        ]);

        const firstCteComment = attachments.find((attachment) => attachment.text === "first cte leading");
        const secondCteComment = attachments.find((attachment) => attachment.text === "second cte leading");

        expect(firstCteComment).toMatchObject({
            placement: "leading",
            targetNode: query.withClause!.tables[0].aliasExpression.table
        });
        expect(secondCteComment).toMatchObject({
            placement: "leading",
            targetNode: query.withClause!.tables[1].aliasExpression
        });
    });

    test("extracts SELECT item comments already represented in the AST", () => {
        const query = SelectQueryParser.parse(`
            SELECT /* value leading */ id /* value trailing */ AS /* as keyword */ identifier /* alias trailing */
            FROM users
        `).toSimpleQuery();
        const selectItem = query.selectClause.items[0];

        const attachments = extractAstCommentAttachments(query);
        const itemAttachments = attachments.filter((attachment) => attachment.targetNode === selectItem);

        expect(selectItem).toBeInstanceOf(SelectItem);
        expect(texts(itemAttachments)).toEqual([
            "value leading",
            "value trailing",
            "as keyword",
            "alias trailing"
        ]);
        expect(itemAttachments.map((attachment) => attachment.placement)).toEqual([
            "leading",
            "trailing",
            "inner",
            "trailing"
        ]);
    });

    test("marks ambiguous comments as detached instead of over-associating them", () => {
        const query = SelectQueryParser.parse(`
            WITH raw_sales AS (
                SELECT id FROM sales
            )
            -- ambiguous main select prefix
            SELECT id FROM raw_sales
        `);

        const attachments = extractAstCommentAttachments(query);
        const ambiguousAttachments = attachments.filter((attachment) => attachment.text === "ambiguous main select prefix");
        const ambiguous = ambiguousAttachments[0];

        expect(ambiguousAttachments).toHaveLength(1);
        expect(ambiguous).toMatchObject({
            placement: "detached"
        });
        expect(ambiguous?.targetNode).toBeUndefined();
    });

    test("does not mutate formatter comment preservation behavior", () => {
        const sql = `
            -- query header
            WITH
            -- cte leading
            raw_sales AS (
                SELECT /* selected id */ id FROM sales
            )
            SELECT id FROM raw_sales
        `;
        const query = SelectQueryParser.parse(sql);
        const untouchedQuery = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({ exportComment: "full" });

        extractAstCommentAttachments(query);

        const after = formatter.format(query).formattedSql;
        const before = formatter.format(untouchedQuery).formattedSql;
        expect(after).toEqual(before);
    });
});
