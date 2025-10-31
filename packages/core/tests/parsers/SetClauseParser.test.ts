import { describe, it, expect } from "vitest";
import { UpdateQueryParser } from "../../src/parsers/UpdateQueryParser";

describe("SetClauseParser", () => {
    it("attaches inline comments before equals to the target column", () => {
        const sql = [
            "update users",
            "set username /* inline note */ = now()",
        ].join("\n");

        const parsed = UpdateQueryParser.parse(sql);
        const setClause = parsed.setClause;
        if (!setClause) {
            throw new Error("Expected SET clause to be present");
        }

        const firstItem = setClause.items[0];
        expect(firstItem.getPositionedComments("after")).toHaveLength(0);
        expect(firstItem.column.getPositionedComments("after")).toEqual(["inline note"]);
    });
});
