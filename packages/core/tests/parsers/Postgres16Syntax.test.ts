import { describe, expect, it } from "vitest";
import { SelectQueryParser } from "../../src/parsers/SelectQueryParser";
import { SqlFormatter } from "../../src/transformers/SqlFormatter";

describe("PostgreSQL 16 syntax", () => {
    const formatter = new SqlFormatter();

    it("formats SQL/JSON IS JSON predicates without treating JSON as an identifier", () => {
        const sql = "SELECT payload IS NOT JSON OBJECT WITH UNIQUE KEYS FROM events";

        const ast = SelectQueryParser.parse(sql);
        const formatted = formatter.format(ast).formattedSql;

        expect(formatted).toBe('select "payload" is not json object with unique keys from "events"');
    });

    it("preserves SQL/JSON constructor argument syntax", () => {
        const sql = "SELECT json_object('id' value id, 'name' value name absent on null returning jsonb) FROM users";

        const ast = SelectQueryParser.parse(sql);
        const formatted = formatter.format(ast).formattedSql;

        expect(formatted).toBe('select json_object(\'id\' value id, \'name\' value name absent on null returning jsonb) from "users"');
    });
});
