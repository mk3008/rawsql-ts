import { describe, it, expect } from "vitest";
import { UpdateQueryParser } from "../../src/parsers/UpdateQueryParser";
import { UpdateQuery } from "../../src/models/UpdateQuery";
import { Formatter } from "../../src/transformers/Formatter";

describe("UpdateQueryParser", () => {
    it("parses simple UPDATE ... SET ... WHERE ...", () => {
        const sql = "UPDATE users SET name = 'Alice', age = 18 WHERE id = 1";
        const ast = UpdateQueryParser.parse(sql);
    });

    it("parses UPDATE with schema and RETURNING", () => {
        const sql = "UPDATE public.users SET active = true RETURNING id, name";
        const ast = UpdateQueryParser.parse(sql);
    });

    it("parses UPDATE ... FROM ...", () => {
        const sql = "UPDATE users SET name = 'Bob' FROM other_users WHERE users.id = other_users.id";
        const ast = UpdateQueryParser.parse(sql);
    });

    it("formats simple UPDATE ... SET ... WHERE ...", () => {
        const sql = "UPDATE users SET name = 'Alice', age = 18 WHERE id = 1";
        const ast = UpdateQueryParser.parse(sql);
        const formatted = new Formatter().format(ast);
        expect(formatted).toBe("update \"users\" set \"name\" = 'Alice', \"age\" = 18 where \"id\" = 1");
    });

    it("formats UPDATE with schema and RETURNING", () => {
        const sql = "UPDATE public.users SET active = true RETURNING id, name";
        const ast = UpdateQueryParser.parse(sql);
        const formatted = new Formatter().format(ast);
        expect(formatted).toBe("update \"public\".\"users\" set \"active\" = true returning \"id\", \"name\"");
    });

    it("formats UPDATE ... FROM ...", () => {
        const sql = "UPDATE users SET name = 'Bob' FROM other_users WHERE users.id = other_users.id";
        const ast = UpdateQueryParser.parse(sql);
        const formatted = new Formatter().format(ast);
        expect(formatted).toBe("update \"users\" set \"name\" = 'Bob' from \"other_users\" where \"users\".\"id\" = \"other_users\".\"id\"");
    });
});
