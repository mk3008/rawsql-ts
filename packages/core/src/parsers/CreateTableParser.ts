import { SqlTokenizer } from "./SqlTokenizer";
import { SelectQueryParser } from "./SelectQueryParser";
import { CreateTableQuery } from "../models/CreateTableQuery";
import { Lexeme, TokenType } from "../models/Lexeme";
import { FullNameParser } from "./FullNameParser";
import type { SelectQuery } from "../models/SelectQuery";

/**
 * Parses CREATE TABLE ... [AS SELECT ...] statements into CreateTableQuery ASTs.
 * Currently focuses on CREATE [TEMPORARY] TABLE ... AS SELECT patterns.
 */
export class CreateTableParser {
    /**
     * Parse SQL string to CreateTableQuery AST.
     * @param query SQL string
     */
    public static parse(query: string): CreateTableQuery {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The CREATE TABLE statement is complete but there are additional tokens.`);
        }
        return result.value;
    }

    /**
     * Parse from lexeme array (for internal use and tests)
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: CreateTableQuery; newIndex: number } {
        let idx = index;

        if (idx >= lexemes.length) {
            throw new Error(`[CreateTableParser] Unexpected end of input at position ${idx}.`);
        }

        const commandToken = lexemes[idx].value;
        const isTemporary = commandToken === "create temporary table";

        if (commandToken !== "create table" && !isTemporary) {
            throw new Error(`[CreateTableParser] Syntax error at position ${idx}: expected 'CREATE TABLE' but found '${lexemes[idx].value}'.`);
        }
        idx++;

        // Optional IF NOT EXISTS
        const tokenAt = (offset: number) => {
            const value = lexemes[idx + offset]?.value;
            return typeof value === "string" ? value.toLowerCase() : undefined;
        };

        let ifNotExists = false;
        const currentToken = tokenAt(0);
        if (currentToken === "if not exists") {
            idx += 1;
            ifNotExists = true;
        }

        if (idx >= lexemes.length) {
            throw new Error(`[CreateTableParser] Expected table name at position ${idx}.`);
        }

        const tableNameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const tableIdentifier = tableNameResult.name;
        const namespaces = tableNameResult.namespaces;
        idx = tableNameResult.newIndex;

        const tableParts: string[] = [];
        if (namespaces && namespaces.length > 0) {
            tableParts.push(...namespaces);
        }
        tableParts.push(tableIdentifier.name);
        const tableName = tableParts.join(".");

        // Prevent unsupported column definition syntax.
        if (lexemes[idx]?.type === TokenType.OpenParen) {
            throw new Error("[CreateTableParser] Column definition syntax is not supported. Use CREATE TABLE ... AS SELECT ... instead.");
        }

        let asSelectQuery: SelectQuery | undefined;
        if (lexemes[idx]?.value === "as") {
            idx++;
            const selectResult = SelectQueryParser.parseFromLexeme(lexemes, idx);
            asSelectQuery = selectResult.value;
            idx = selectResult.newIndex;
        } else if (lexemes[idx]?.value === "select" || lexemes[idx]?.value === "with") {
            // Allow omitting AS keyword before SELECT / WITH.
            const selectResult = SelectQueryParser.parseFromLexeme(lexemes, idx);
            asSelectQuery = selectResult.value;
            idx = selectResult.newIndex;
        }

        return {
            value: new CreateTableQuery({
                tableName,
                isTemporary,
                ifNotExists,
                asSelectQuery
            }),
            newIndex: idx
        };
    }
}
