import { SqlTokenizer } from "./SqlTokenizer";
import { DropTableStatement, DropBehavior } from "../models/DDLStatements";
import { Lexeme, TokenType } from "../models/Lexeme";
import { FullNameParser } from "./FullNameParser";
import { QualifiedName } from "../models/ValueComponent";

/**
 * Parses DROP TABLE statements.
 */
export class DropTableParser {
    public static parse(sql: string): DropTableStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`[DropTableParser] Unexpected token "${lexemes[result.newIndex].value}" after DROP TABLE statement.`);
        }
        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: DropTableStatement; newIndex: number } {
        let idx = index;

        if (lexemes[idx]?.value.toLowerCase() !== "drop table") {
            throw new Error(`[DropTableParser] Expected DROP TABLE at index ${idx}.`);
        }
        idx++;

        // Handle optional IF EXISTS modifier.
        let ifExists = false;
        if (lexemes[idx]?.value.toLowerCase() === "if exists") {
            ifExists = true;
            idx++;
        }

        const tables: QualifiedName[] = [];

        // Parse comma-separated table list.
        while (idx < lexemes.length) {
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            tables.push(new QualifiedName(namespaces, name));
            idx = newIndex;

            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
                continue;
            }

            break;
        }

        if (tables.length === 0) {
            throw new Error("[DropTableParser] DROP TABLE must specify at least one table.");
        }

        let behavior: DropBehavior = null;
        const nextValue = lexemes[idx]?.value.toLowerCase();
        if (nextValue === "cascade" || nextValue === "restrict") {
            behavior = nextValue as DropBehavior;
            idx++;
        }

        return {
            value: new DropTableStatement({ tables, ifExists, behavior }),
            newIndex: idx
        };
    }
}
