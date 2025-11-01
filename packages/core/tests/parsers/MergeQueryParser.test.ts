import { describe, it, expect } from "vitest";
import { MergeQueryParser } from "../../src/parsers/MergeQueryParser";
import { MergeQuery, MergeUpdateAction, MergeInsertAction, MergeDeleteAction, MergeDoNothingAction } from "../../src/models/MergeQuery";
import { ValueList } from "../../src/models/ValueComponent";

describe("MergeQueryParser", () => {
    it("parses MERGE with UPDATE and INSERT actions", () => {
        const sql = `
            MERGE INTO target t
            USING source s
            ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET name = s.name, updated_at = s.updated_at
            WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name);
        `;

        const result = MergeQueryParser.parse(sql);

        expect(result).toBeInstanceOf(MergeQuery);
        expect(result.whenClauses).toHaveLength(2);

        const matchedClause = result.whenClauses[0];
        expect(matchedClause.matchType).toBe("matched");
        expect(matchedClause.condition).toBeNull();
        expect(matchedClause.action).toBeInstanceOf(MergeUpdateAction);

        const updateAction = matchedClause.action as MergeUpdateAction;
        expect(updateAction.setClause.items).toHaveLength(2);
        expect(updateAction.whereClause).toBeNull();

        const notMatchedClause = result.whenClauses[1];
        expect(notMatchedClause.matchType).toBe("not_matched");
        expect(notMatchedClause.action).toBeInstanceOf(MergeInsertAction);

        const insertAction = notMatchedClause.action as MergeInsertAction;
        expect(insertAction.columns).toHaveLength(2);
        expect(insertAction.values).toBeInstanceOf(ValueList);
        expect(insertAction.defaultValues).toBe(false);
    });

    it("parses MERGE with conditional DELETE, DO NOTHING, and DEFAULT VALUES", () => {
        const sql = `
            WITH incoming AS (
                SELECT 1 AS id, 'x' AS name, false AS should_delete
            )
            MERGE INTO target t
            USING incoming s
            ON t.id = s.id
            WHEN MATCHED AND s.should_delete = true THEN DELETE WHERE t.active = true
            WHEN NOT MATCHED BY SOURCE THEN DO NOTHING
            WHEN NOT MATCHED BY TARGET THEN INSERT DEFAULT VALUES;
        `;

        const result = MergeQueryParser.parse(sql);

        expect(result.withClause).not.toBeNull();
        expect(result.whenClauses).toHaveLength(3);

        const deleteClause = result.whenClauses[0];
        expect(deleteClause.matchType).toBe("matched");
        expect(deleteClause.condition).not.toBeNull();
        expect(deleteClause.action).toBeInstanceOf(MergeDeleteAction);
        const deleteAction = deleteClause.action as MergeDeleteAction;
        expect(deleteAction.whereClause).not.toBeNull();

        const doNothingClause = result.whenClauses[1];
        expect(doNothingClause.matchType).toBe("not_matched_by_source");
        expect(doNothingClause.action).toBeInstanceOf(MergeDoNothingAction);

        const defaultInsertClause = result.whenClauses[2];
        expect(defaultInsertClause.matchType).toBe("not_matched_by_target");
        expect(defaultInsertClause.action).toBeInstanceOf(MergeInsertAction);

        const defaultInsertAction = defaultInsertClause.action as MergeInsertAction;
        expect(defaultInsertAction.columns).toBeNull();
        expect(defaultInsertAction.defaultValues).toBe(true);
        expect(defaultInsertAction.values).toBeNull();
    });

    it("preserves comments throughout MERGE update and insert actions", () => {
        const sql = [
            "-- c1",
            "merge into users as target --c2",
            "using temp_users as source --c3",
            "on target.user_id = source.user_id --c4",
            "when matched then",
            "    --c5",
            "    update set",
            "        --c6",
            "        username = source.username",
            "        --c7",
            "        ,",
            "        --c8",
            "        email = source.email",
            "        --c9",
            "        ,",
            "        --c10",
            "        updated_at = now()",
            "        --c11",
            "when not matched then",
            "    -- c12",
            "    insert (user_id, username, email, created_at) --c13",
            "    values (source.user_id, source.username, source.email, now())",
            "    --c14"
        ].join("\n");

        const result = MergeQueryParser.parse(sql);

        const matchedClause = result.whenClauses[0];
        const updateAction = matchedClause.action as MergeUpdateAction;
        const insertClause = result.whenClauses[1];
        const insertAction = insertClause.action as MergeInsertAction;

        // Leading MERGE comment should be preserved on the query.
        expect(result.getPositionedComments("before")).toContain("c1");

        // Comments preceding UPDATE and the first assignment should be retained.
        expect(updateAction.getPositionedComments("before")).toContain("c5");
        expect(updateAction.setClause.items[0].column.getPositionedComments("before")).toContain("c6");

        // Comments around the INSERT branch should remain attached.
        expect(insertAction.getPositionedComments("before")).toContain("c12");
        expect(insertAction.getValuesLeadingComments()).toContain("c13");
        expect(insertAction.values?.getPositionedComments("after")).toContain("c14");
    });

    it("keeps comments preceding THEN separate from action comments", () => {
        const sql = [
            "merge into users as target",
            "using staging_users as source",
            "on target.user_id = source.user_id",
            "when matched -- c_before_then",
            "then",
            "    -- c_after_then",
            "    update set username = source.username",
            "when not matched then",
            "    insert default values"
        ].join("\n");

        const result = MergeQueryParser.parse(sql);
        const clause = result.whenClauses[0];
        const action = clause.action as MergeUpdateAction;

        expect(clause.getThenLeadingComments()).toContain("c_before_then");
        expect(clause.getThenLeadingComments()).not.toContain("c_after_then");
        expect(action.getPositionedComments("before")).toContain("c_after_then");
        expect(action.getPositionedComments("before")).not.toContain("c_before_then");
    });
});
