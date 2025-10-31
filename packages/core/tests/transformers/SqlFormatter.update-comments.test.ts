import { describe, it, expect } from "vitest";
import { UpdateQueryParser } from "../../src/parsers/UpdateQueryParser";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";

describe("SqlFormatter update comments", () => {
    it("preserves positioned comments within SET clause assignments", () => {
        const sql = `-- ================================================
-- sample
-- ================================================
update users
set
    -- comment1
    username = 'zunda_master',  
    email = 'zunda_master@example.com',
    updated_at = now() --comment2
where
    user_id = 1001;`;

        // Parse once to capture comment metadata alongside the AST.
        const parsed = UpdateQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: "lower",
            newline: "\n",
            indentChar: " ",
            indentSize: 4,
            identifierEscape: "none",
        });

        const { formattedSql } = formatter.format(parsed);

        expect(formattedSql).toContain("set\n    /* comment1 */");
        expect(formattedSql).toContain("\n    username = 'zunda_master'");
        expect(formattedSql).toContain("updated_at = now() /* comment2 */");
        expect(formattedSql.indexOf("/* comment1 */")).toBeLessThan(formattedSql.indexOf("username ="));
        expect(formattedSql.indexOf("/* comment2 */")).toBeGreaterThan(formattedSql.indexOf("updated_at = now()"));
        expect(formattedSql).toMatch(/^\/\* ================================================ \*\/\n\/\* sample \*\/\n\/\* ================================================ \*\/\nupdate users/);
    });
    it("deduplicates positioned comments in multi-line SET clauses", () => {
        const sql = [
            "update users",
            "set",
            "    -- a",
            "    username = 1,  -- b",
            "    email = 2, -- c",
            "    updated_at = now() -- d",
        ].join("\n");

        const parsed = UpdateQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: "lower",
            newline: "\n",
            indentChar: " ",
            indentSize: 4,
            identifierEscape: "none",
        });

        const { formattedSql } = formatter.format(parsed);

        expect(formattedSql.match(/\* b \*/g)).toHaveLength(1);
        expect(formattedSql.match(/\* c \*/g)).toHaveLength(1);
    });
});
