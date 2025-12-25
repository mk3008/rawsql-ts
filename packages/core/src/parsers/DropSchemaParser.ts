import { SqlTokenizer } from "./SqlTokenizer";
import { DropSchemaStatement, DropBehavior } from "../models/DDLStatements";
import { Lexeme, TokenType } from "../models/Lexeme";
import { FullNameParser } from "./FullNameParser";
import { QualifiedName } from "../models/ValueComponent";

/**
 * Parses DROP SCHEMA statements.
 */
export class DropSchemaParser {
    public static parse(sql: string): DropSchemaStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`[DropSchemaParser] Unexpected token "${lexemes[result.newIndex].value}" after DROP SCHEMA statement.`);
        }
        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: DropSchemaStatement; newIndex: number } {
        let idx = index;

        if (lexemes[idx]?.value.toLowerCase() !== "drop schema") {
            throw new Error(`[DropSchemaParser] Expected DROP SCHEMA at index ${idx}.`);
        }
        idx++;

        // Handle optional IF EXISTS modifier.
        let ifExists = false;
        if (lexemes[idx]?.value.toLowerCase() === "if exists") {
            ifExists = true;
            idx++;
        }

        const schemaNames: QualifiedName[] = [];

        // Parse comma-separated schema identifiers.
        while (idx < lexemes.length) {
            if (!lexemes[idx]) {
                break;
            }

            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            schemaNames.push(new QualifiedName(namespaces, name));
            idx = newIndex;

            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
                continue;
            }

            break;
        }

        if (schemaNames.length === 0) {
            throw new Error("[DropSchemaParser] DROP SCHEMA must specify at least one schema name.");
        }

        // Handle optional CASCADE/RESTRICT behavior.
        let behavior: DropBehavior = null;
        const nextValue = lexemes[idx]?.value.toLowerCase();
        if (nextValue === "cascade" || nextValue === "restrict") {
            behavior = nextValue as DropBehavior;
            idx++;
        }

        return {
            value: new DropSchemaStatement({ schemaNames, ifExists, behavior }),
            newIndex: idx
        };
    }
}
