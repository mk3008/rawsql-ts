import { SqlTokenizer } from "./SqlTokenizer";
import { DropIndexStatement, DropBehavior } from "../models/DDLStatements";
import { Lexeme, TokenType } from "../models/Lexeme";
import { FullNameParser } from "./FullNameParser";
import { QualifiedName } from "../models/ValueComponent";

/**
 * Parses DROP INDEX statements.
 */
export class DropIndexParser {
    public static parse(sql: string): DropIndexStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`[DropIndexParser] Unexpected token "${lexemes[result.newIndex].value}" after DROP INDEX statement.`);
        }
        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: DropIndexStatement; newIndex: number } {
        let idx = index;

        if (lexemes[idx]?.value.toLowerCase() !== "drop index") {
            throw new Error(`[DropIndexParser] Expected DROP INDEX at index ${idx}.`);
        }
        idx++;

        // Parse optional CONCURRENTLY modifier.
        let concurrently = false;
        if (lexemes[idx]?.value.toLowerCase() === "concurrently") {
            concurrently = true;
            idx++;
        }

        // Parse optional IF EXISTS modifier.
        let ifExists = false;
        if (lexemes[idx]?.value.toLowerCase() === "if exists") {
            ifExists = true;
            idx++;
        }

        const indexNames: QualifiedName[] = [];

        // Parse comma-separated index identifiers.
        while (idx < lexemes.length) {
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            indexNames.push(new QualifiedName(namespaces, name));
            idx = newIndex;

            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
                continue;
            }

            break;
        }

        if (indexNames.length === 0) {
            throw new Error("[DropIndexParser] DROP INDEX must specify at least one index name.");
        }

        let behavior: DropBehavior = null;
        const nextValue = lexemes[idx]?.value.toLowerCase();
        if (nextValue === "cascade" || nextValue === "restrict") {
            behavior = nextValue as DropBehavior;
            idx++;
        }

        return {
            value: new DropIndexStatement({ indexNames, concurrently, ifExists, behavior }),
            newIndex: idx
        };
    }
}
