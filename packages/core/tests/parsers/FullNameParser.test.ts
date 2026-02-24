import { describe, expect, it } from "vitest";
import { Lexeme, TokenType } from "../../src/models/Lexeme";
import { FullNameParser } from "../../src/parsers/FullNameParser";

describe("FullNameParser", () => {
    it("transfers positioned comments from the final identifier lexeme", () => {
        const lexemes: Lexeme[] = [
            { type: TokenType.Identifier, value: "public", comments: null },
            { type: TokenType.Dot, value: ".", comments: null },
            {
                type: TokenType.Identifier,
                value: "users",
                comments: null,
                positionedComments: [{ position: "after", comments: ["table comment"] }]
            }
        ];

        const result = FullNameParser.parseFromLexeme(lexemes, 0);

        expect(result.namespaces).toEqual(["public"]);
        expect(result.name.name).toBe("users");
        expect(result.name.positionedComments).toEqual([
            { position: "after", comments: ["table comment"] }
        ]);
    });

    it("transfers legacy comments when positioned comments are absent", () => {
        const lexemes: Lexeme[] = [
            { type: TokenType.Identifier, value: "users", comments: ["legacy comment"] }
        ];

        const result = FullNameParser.parseFromLexeme(lexemes, 0);

        expect(result.name.name).toBe("users");
        expect(result.name.positionedComments).toBeNull();
        expect(result.name.comments).toEqual(["legacy comment"]);
    });

    it("accepts selected PostgreSQL non-reserved keywords as unquoted identifiers", () => {
        const keywordSamples = ["groups", "rows", "range", "partition"];
        for (const identifier of keywordSamples) {
            const parsed = FullNameParser.parse(identifier);
            expect(parsed.name.name).toBe(identifier);
        }
    });

    it("does not accept reserved keywords as identifier exceptions", () => {
        expect(() => FullNameParser.parse("select")).toThrow("Identifier list is empty");
    });
});
