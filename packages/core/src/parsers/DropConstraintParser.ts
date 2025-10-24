import { SqlTokenizer } from "./SqlTokenizer";
import { DropConstraintStatement, DropBehavior } from "../models/DDLStatements";
import { Lexeme } from "../models/Lexeme";
import { FullNameParser } from "./FullNameParser";

/**
 * Parses standalone DROP CONSTRAINT statements.
 */
export class DropConstraintParser {
    public static parse(sql: string): DropConstraintStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`[DropConstraintParser] Unexpected token "${lexemes[result.newIndex].value}" after DROP CONSTRAINT statement.`);
        }
        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: DropConstraintStatement; newIndex: number } {
        let idx = index;

        if (lexemes[idx]?.value.toLowerCase() !== "drop constraint") {
            throw new Error(`[DropConstraintParser] Expected DROP CONSTRAINT at index ${idx}.`);
        }
        idx++;

        let ifExists = false;
        if (lexemes[idx]?.value.toLowerCase() === "if exists") {
            ifExists = true;
            idx++;
        }

        const { name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
        idx = newIndex;

        let behavior: DropBehavior = null;
        const nextValue = lexemes[idx]?.value.toLowerCase();
        if (nextValue === "cascade" || nextValue === "restrict") {
            behavior = nextValue as DropBehavior;
            idx++;
        }

        return {
            value: new DropConstraintStatement({
                constraintName: name,
                ifExists,
                behavior
            }),
            newIndex: idx
        };
    }
}
