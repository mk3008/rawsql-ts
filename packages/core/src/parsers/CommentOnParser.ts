import { CommentOnStatement } from "../models/DDLStatements";
import { Lexeme } from "../models/Lexeme";
import { QualifiedName } from "../models/ValueComponent";
import { FullNameParser } from "./FullNameParser";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

/**
 * Parses COMMENT ON TABLE/COLUMN statements.
 */
export class CommentOnParser {
    /**
     * Parses a full SQL string containing a single COMMENT ON statement.
     * @param sql SQL text containing one COMMENT ON TABLE/COLUMN statement.
     * @returns Parsed COMMENT ON statement model.
     */
    public static parse(sql: string): CommentOnStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`[CommentOnParser] Unexpected token "${lexemes[result.newIndex].value}" after COMMENT ON statement.`);
        }
        return result.value;
    }

    /**
     * Parses COMMENT ON tokens from a lexeme array starting at the specified index.
     * @param lexemes Tokenized SQL lexemes.
     * @param index Lexeme index where COMMENT ON parsing starts.
     * @returns Parsed statement and the next unread lexeme index.
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: CommentOnStatement; newIndex: number } {
        let idx = index;
        const command = lexemes[idx]?.value.toLowerCase();
        if (command !== "comment on table" && command !== "comment on column") {
            throw new Error(`[CommentOnParser] Expected COMMENT ON TABLE or COMMENT ON COLUMN at index ${idx}.`);
        }
        const targetKind = command === "comment on table" ? "table" : "column";
        idx++;

        const targetResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const target = new QualifiedName(targetResult.namespaces, targetResult.name);
        idx = targetResult.newIndex;

        if (lexemes[idx]?.value.toLowerCase() !== "is") {
            throw new Error(`[CommentOnParser] Expected IS keyword at index ${idx}.`);
        }
        idx++;

        if (lexemes[idx]?.value.toLowerCase() === "null") {
            idx++;
            return {
                value: new CommentOnStatement({ targetKind, target, comment: null }),
                newIndex: idx,
            };
        }

        const valueResult = ValueParser.parseFromLexeme(lexemes, idx);
        idx = valueResult.newIndex;

        return {
            value: new CommentOnStatement({ targetKind, target, comment: valueResult.value }),
            newIndex: idx,
        };
    }
}
