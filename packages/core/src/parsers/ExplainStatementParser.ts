import { SqlTokenizer } from "./SqlTokenizer";
import { ExplainOption, ExplainStatement } from "../models/DDLStatements";
import { IdentifierString, RawString, ValueComponent } from "../models/ValueComponent";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ValueParser } from "./ValueParser";
import { SqlComponent } from "../models/SqlComponent";

type NestedStatementParser = (lexemes: Lexeme[], index: number) => { value: SqlComponent; newIndex: number };

/**
 * Parses EXPLAIN statements including legacy shorthand flags and option lists.
 */
export class ExplainStatementParser {
    public static parse(
        sql: string,
        parseNested: NestedStatementParser
    ): ExplainStatement {
        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexemes();
        const result = this.parseFromLexeme(lexemes, 0, parseNested);
        if (result.newIndex < lexemes.length) {
            throw new Error(
                `[ExplainStatementParser] Unexpected token "${lexemes[result.newIndex].value}" after EXPLAIN statement.`
            );
        }
        return result.value;
    }

    public static parseFromLexeme(
        lexemes: Lexeme[],
        index: number,
        parseNested: NestedStatementParser
    ): { value: ExplainStatement; newIndex: number } {
        let idx = index;

        const first = lexemes[idx];
        if (!first || first.value.toLowerCase() !== "explain") {
            throw new Error(`[ExplainStatementParser] Expected EXPLAIN at index ${idx}.`);
        }
        idx++;

        const options: ExplainOption[] = [];

        // Collect legacy shorthand flags (ANALYZE, VERBOSE) before option list.
        while (this.isLegacyFlag(lexemes[idx])) {
            const flagLexeme = lexemes[idx] as Lexeme;
            const optionName = new IdentifierString(flagLexeme.value.toLowerCase());
            if (flagLexeme.comments && flagLexeme.comments.length > 0) {
                optionName.comments = [...flagLexeme.comments];
            }
            const option = new ExplainOption({
                name: optionName,
                value: new RawString("true"),
            });
            options.push(option);
            idx++;
        }

        // Parse optional parenthesised option list.
        if (lexemes[idx] && (lexemes[idx].type & TokenType.OpenParen) !== 0) {
            const optionResult = this.parseOptionList(lexemes, idx);
            options.push(...optionResult.options);
            idx = optionResult.newIndex;
        }

        if (idx >= lexemes.length) {
            throw new Error("[ExplainStatementParser] EXPLAIN must be followed by a statement to analyze.");
        }

        const nested = parseNested(lexemes, idx);
        const statement = nested.value;
        idx = nested.newIndex;

        const explain = new ExplainStatement({
            options: options.length > 0 ? options : null,
            statement,
        });

        return { value: explain, newIndex: idx };
    }

    private static parseOptionList(lexemes: Lexeme[], index: number): { options: ExplainOption[]; newIndex: number } {
        let idx = index;

        if (!(lexemes[idx].type & TokenType.OpenParen)) {
            throw new Error(`[ExplainStatementParser] Expected '(' to start option list at index ${idx}.`);
        }
        idx++; // consume '('

        const options: ExplainOption[] = [];

        while (idx < lexemes.length) {
            const token = lexemes[idx];

            if (!token) {
                throw new Error("[ExplainStatementParser] Unterminated option list.");
            }

            if (token.type & TokenType.CloseParen) {
                idx++; // consume ')'
                break;
            }

            if (!this.canStartOptionName(token)) {
                throw new Error(
                    `[ExplainStatementParser] Expected option name inside EXPLAIN option list at index ${idx}, found "${token.value}".`
                );
            }

            const nameComponent = new IdentifierString(token.value.toLowerCase());
            if (token.comments && token.comments.length > 0) {
                nameComponent.comments = [...token.comments];
            }
            idx++;

            let value: ValueComponent | null = null;

            // Optional equals sign before value.
            if (lexemes[idx] && (lexemes[idx].type & TokenType.Operator) && lexemes[idx].value === "=") {
                idx++;
            }

            // Consume explicit value when present (anything other than comma/close paren).
            if (lexemes[idx] && !(lexemes[idx].type & TokenType.Comma) && !(lexemes[idx].type & TokenType.CloseParen)) {
                const parsedValue = ValueParser.parseFromLexeme(lexemes, idx);
                value = parsedValue.value;
                idx = parsedValue.newIndex;
            }

            if (!value) {
                value = new RawString("true");
            }

            options.push(new ExplainOption({ name: nameComponent, value }));

            if (!lexemes[idx]) {
                throw new Error("[ExplainStatementParser] Unterminated option list.");
            }

            if (lexemes[idx].type & TokenType.Comma) {
                idx++;
                continue;
            }

            if (lexemes[idx].type & TokenType.CloseParen) {
                idx++;
                break;
            }

            throw new Error(
                `[ExplainStatementParser] Expected ',' or ')' after EXPLAIN option at index ${idx}, found "${lexemes[idx].value}".`
            );
        }

        return { options, newIndex: idx };
    }

    private static isLegacyFlag(lexeme: Lexeme | undefined): boolean {
        if (!lexeme) {
            return false;
        }
        if (!(lexeme.type & (TokenType.Identifier | TokenType.Command | TokenType.Function | TokenType.Type))) {
            return false;
        }
        const keyword = lexeme.value.toLowerCase();
        return keyword === "analyze" || keyword === "verbose";
    }

    private static canStartOptionName(lexeme: Lexeme): boolean {
        return (lexeme.type & (TokenType.Identifier | TokenType.Command | TokenType.Function | TokenType.Type)) !== 0;
    }
}
