import { SqlTokenizer } from "./SqlTokenizer";
import { CreateSchemaStatement } from "../models/DDLStatements";
import { Lexeme } from "../models/Lexeme";
import { FullNameParser } from "./FullNameParser";
import { QualifiedName, IdentifierString } from "../models/ValueComponent";

/**
 * Parses CREATE SCHEMA statements.
 */
export class CreateSchemaParser {
    public static parse(sql: string): CreateSchemaStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`[CreateSchemaParser] Unexpected token "${lexemes[result.newIndex].value}" after CREATE SCHEMA statement.`);
        }
        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: CreateSchemaStatement; newIndex: number } {
        let idx = index;

        if (lexemes[idx]?.value.toLowerCase() !== "create schema") {
            throw new Error(`[CreateSchemaParser] Expected CREATE SCHEMA at index ${idx}.`);
        }
        idx++;

        // Handle optional IF NOT EXISTS modifier.
        let ifNotExists = false;
        if (lexemes[idx]?.value.toLowerCase() === "if not exists") {
            ifNotExists = true;
            idx++;
        }

        if (!lexemes[idx]) {
            throw new Error("[CreateSchemaParser] Missing schema name.");
        }

        // Parse the target schema identifier.
        const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
        const schemaName = new QualifiedName(namespaces, name);
        idx = newIndex;

        // Handle optional AUTHORIZATION clause so ownership can be preserved.
        let authorization: IdentifierString | null = null;
        if (lexemes[idx]?.value.toLowerCase() === "authorization") {
            idx++;
            if (!lexemes[idx]) {
                throw new Error("[CreateSchemaParser] Expected identifier after AUTHORIZATION.");
            }

            const authResult = FullNameParser.parseFromLexeme(lexemes, idx);
            authorization = authResult.name;
            idx = authResult.newIndex;
        }

        return {
            value: new CreateSchemaStatement({ schemaName, ifNotExists, authorization }),
            newIndex: idx
        };
    }
}
