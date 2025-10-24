import { SqlTokenizer } from "./SqlTokenizer";
import {
    CreateIndexStatement,
    IndexColumnDefinition,
    IndexSortOrder,
    IndexNullsOrder
} from "../models/DDLStatements";
import { Lexeme, TokenType } from "../models/Lexeme";
import { FullNameParser } from "./FullNameParser";
import { QualifiedName, IdentifierString, RawString, ValueComponent } from "../models/ValueComponent";
import { ValueParser } from "./ValueParser";

/**
 * Parses CREATE INDEX statements.
 */
export class CreateIndexParser {
    public static parse(sql: string): CreateIndexStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`[CreateIndexParser] Unexpected token "${lexemes[result.newIndex].value}" after CREATE INDEX.`);
        }
        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: CreateIndexStatement; newIndex: number } {
        let idx = index;

        const firstToken = lexemes[idx]?.value.toLowerCase();
        if (firstToken !== "create index" && firstToken !== "create unique index") {
            throw new Error(`[CreateIndexParser] Expected CREATE INDEX at index ${idx}.`);
        }
        const unique = firstToken === "create unique index";
        idx++;

        let concurrently = false;
        if (lexemes[idx]?.value.toLowerCase() === "concurrently") {
            concurrently = true;
            idx++;
        }

        let ifNotExists = false;
        if (lexemes[idx]?.value.toLowerCase() === "if not exists") {
            ifNotExists = true;
            idx++;
        }

        const indexNameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const indexName = new QualifiedName(indexNameResult.namespaces, indexNameResult.name);
        idx = indexNameResult.newIndex;

        if (lexemes[idx]?.value.toLowerCase() !== "on") {
            throw new Error(`[CreateIndexParser] Expected ON keyword before table name at index ${idx}.`);
        }
        idx++;

        const tableResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const tableName = new QualifiedName(tableResult.namespaces, tableResult.name);
        idx = tableResult.newIndex;

        let usingMethod: IdentifierString | RawString | null = null;
        if (lexemes[idx]?.value.toLowerCase() === "using") {
            idx++;
            const methodResult = FullNameParser.parseFromLexeme(lexemes, idx);
            usingMethod = methodResult.name;
            idx = methodResult.newIndex;
        }

        const columnsResult = this.parseIndexColumnList(lexemes, idx);
        const columns = columnsResult.columns;
        idx = columnsResult.newIndex;

        let include: IdentifierString[] | null = null;
        if (lexemes[idx]?.value.toLowerCase() === "include") {
            idx++;
            const includeResult = this.parseIdentifierList(lexemes, idx);
            include = includeResult.identifiers;
            idx = includeResult.newIndex;
        }

        let withOptions: RawString | null = null;
        if (lexemes[idx]?.value.toLowerCase() === "with") {
            const withResult = this.parseWithOptions(lexemes, idx);
            withOptions = withResult.options;
            idx = withResult.newIndex;
        }

        let tablespace: IdentifierString | null = null;
        if (lexemes[idx]?.value.toLowerCase() === "tablespace") {
            idx++;
            const tablespaceResult = FullNameParser.parseFromLexeme(lexemes, idx);
            tablespace = tablespaceResult.name;
            idx = tablespaceResult.newIndex;
        }

        let whereClause: ValueComponent | undefined;
        if (lexemes[idx]?.value.toLowerCase() === "where") {
            idx++;
            const whereResult = ValueParser.parseFromLexeme(lexemes, idx);
            whereClause = whereResult.value;
            idx = whereResult.newIndex;
        }

        return {
            value: new CreateIndexStatement({
                unique,
                concurrently,
                ifNotExists,
                indexName,
                tableName,
                usingMethod,
                columns,
                include,
                withOptions,
                tablespace,
                where: whereClause
            }),
            newIndex: idx
        };
    }

    private static parseIndexColumnList(lexemes: Lexeme[], index: number): { columns: IndexColumnDefinition[]; newIndex: number } {
        let idx = index;
        if (lexemes[idx]?.type !== TokenType.OpenParen) {
            throw new Error(`[CreateIndexParser] Expected '(' starting column list at index ${idx}.`);
        }
        idx++;

        const columns: IndexColumnDefinition[] = [];

        while (idx < lexemes.length) {
            const expressionResult = ValueParser.parseFromLexeme(lexemes, idx);
            idx = expressionResult.newIndex;

            let sortOrder: IndexSortOrder = null;
            let nullsOrder: IndexNullsOrder = null;
            let collation: QualifiedName | null = null;
            let operatorClass: QualifiedName | null = null;

            while (idx < lexemes.length) {
                const tokenValue = lexemes[idx].value.toLowerCase();

                if (tokenValue === "asc" || tokenValue === "desc") {
                    sortOrder = tokenValue as IndexSortOrder;
                    idx++;
                    continue;
                }

                if (tokenValue === "nulls first" || tokenValue === "nulls last") {
                    nullsOrder = tokenValue.endsWith("first") ? "first" : "last";
                    idx++;
                    continue;
                }

                if (tokenValue === "collate") {
                    idx++;
                    const collateResult = FullNameParser.parseFromLexeme(lexemes, idx);
                    collation = new QualifiedName(collateResult.namespaces, collateResult.name);
                    idx = collateResult.newIndex;
                    continue;
                }

                if (this.isClauseTerminator(tokenValue) || (lexemes[idx].type & (TokenType.Comma | TokenType.CloseParen))) {
                    break;
                }

                if (lexemes[idx].type & (TokenType.Identifier | TokenType.Type | TokenType.Function)) {
                    const opClassResult = FullNameParser.parseFromLexeme(lexemes, idx);
                    operatorClass = new QualifiedName(opClassResult.namespaces, opClassResult.name);
                    idx = opClassResult.newIndex;
                    continue;
                }

                break;
            }

            columns.push(new IndexColumnDefinition({
                expression: expressionResult.value,
                sortOrder,
                nullsOrder,
                collation,
                operatorClass
            }));

            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
                continue;
            }

            if (lexemes[idx]?.type === TokenType.CloseParen) {
                idx++;
                break;
            }
        }

        return { columns, newIndex: idx };
    }

    private static parseIdentifierList(lexemes: Lexeme[], index: number): { identifiers: IdentifierString[]; newIndex: number } {
        let idx = index;
        if (lexemes[idx]?.type !== TokenType.OpenParen) {
            throw new Error(`[CreateIndexParser] Expected '(' starting identifier list at index ${idx}.`);
        }
        idx++;
        const identifiers: IdentifierString[] = [];

        while (idx < lexemes.length) {
            const result = FullNameParser.parseFromLexeme(lexemes, idx);
            identifiers.push(result.name);
            idx = result.newIndex;

            if (lexemes[idx]?.type === TokenType.Comma) {
                idx++;
                continue;
            }

            if (lexemes[idx]?.type === TokenType.CloseParen) {
                idx++;
                break;
            }
        }

        return { identifiers, newIndex: idx };
    }

    private static parseWithOptions(lexemes: Lexeme[], index: number): { options: RawString; newIndex: number } {
        let idx = index;
        const start = idx;
        if (lexemes[idx]?.value.toLowerCase() !== "with") {
            throw new Error(`[CreateIndexParser] Expected WITH keyword at index ${idx}.`);
        }
        idx++;
        if (lexemes[idx]?.type !== TokenType.OpenParen) {
            throw new Error(`[CreateIndexParser] Expected '(' after WITH at index ${idx}.`);
        }

        let depth = 0;
        while (idx < lexemes.length) {
            if (lexemes[idx].type === TokenType.OpenParen) {
                depth++;
            } else if (lexemes[idx].type === TokenType.CloseParen) {
                depth--;
                if (depth === 0) {
                    idx++;
                    break;
                }
            }
            idx++;
        }

        const text = this.joinLexemeValues(lexemes, start, idx);
        return {
            options: new RawString(text),
            newIndex: idx
        };
    }

    private static isClauseTerminator(value: string): boolean {
        return value === "include" ||
            value === "with" ||
            value === "where" ||
            value === "tablespace";
    }

    private static joinLexemeValues(lexemes: Lexeme[], start: number, end: number): string {
        const noSpaceBefore = new Set([",", ")", "]", "}", ";"]);
        const noSpaceAfter = new Set(["(", "[", "{"]);
        let result = "";
        for (let i = start; i < end; i++) {
            const current = lexemes[i];
            if (result.length === 0) {
                result = current.value;
                continue;
            }
            const prevValue = lexemes[i - 1]?.value ?? "";
            const omitSpace =
                noSpaceBefore.has(current.value) ||
                noSpaceAfter.has(prevValue) ||
                current.value === "." ||
                prevValue === ".";
            result += omitSpace ? current.value : ` ${current.value}`;
        }
        return result;
    }
}
