import { describe, expect, it } from "vitest";
import { MergeQueryParser } from "../../src/parsers/MergeQueryParser";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";

describe("PostgreSQL 17 syntax", () => {
    it("keeps MERGE RETURNING with merge_action()", () => {
        const sql = [
            "MERGE INTO users AS target",
            "USING incoming_users AS source",
            "ON target.user_id = source.user_id",
            "WHEN MATCHED THEN UPDATE SET name = source.name",
            "WHEN NOT MATCHED BY SOURCE THEN DO NOTHING",
            "RETURNING merge_action() AS action, target.user_id"
        ].join(" ");

        const ast = MergeQueryParser.parse(sql);
        const formatted = new SqlFormatter().format(ast).formattedSql;

        expect(ast.returningClause?.items).toHaveLength(2);
        expect(formatted).toBe('merge into "users" as "target" using "incoming_users" as "source" on "target"."user_id" = "source"."user_id" when matched then update set "name" = "source"."name" when not matched by source then do nothing returning merge_action() as "action", "target"."user_id"');
    });
});
