import { Lexeme, TokenType } from "../models/Lexeme";
import { ValuesQuery } from "../models/SelectQuery";
import { TupleExpression, ValueComponent } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class ValuesQueryParser {
    public static parse(query: string): ValuesQuery {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The VALUES clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValuesQuery; newIndex: number } {
        let idx = index;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error at position ${idx}: Expected 'VALUES' keyword but input ended early.`);
        }

        const valuesLexeme = lexemes[idx];
        if (valuesLexeme.value.toLowerCase() !== 'values') {
            throw new Error(`Syntax error at position ${idx}: Expected 'VALUES' keyword but found "${valuesLexeme.value}". VALUES clauses must start with the VALUES keyword.`);
        }

        const valuesComments = this.extractLexemeComments(valuesLexeme);
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'VALUES' keyword. The VALUES clause requires at least one tuple expression.`);
        }

        const tuples: TupleExpression[] = [];

        const firstTuple = this.parseTuple(lexemes, idx);
        tuples.push(firstTuple.value);
        idx = firstTuple.newIndex;

        if (valuesComments.after.length > 0) {
            firstTuple.value.addPositionedComments('before', valuesComments.after);
        }

        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++;
            const tuple = this.parseTuple(lexemes, idx);
            tuples.push(tuple.value);
            idx = tuple.newIndex;
        }

        const query = new ValuesQuery(tuples);
        if (valuesComments.before.length > 0) {
            query.headerComments = valuesComments.before;
        }

        return { value: query, newIndex: idx };
    }

    private static parseTuple(lexemes: Lexeme[], index: number): { value: TupleExpression; newIndex: number } {
        let idx = index;

        if (idx >= lexemes.length || lexemes[idx].type !== TokenType.OpenParen) {
            throw new Error(`Syntax error at position ${idx}: Expected opening parenthesis but found "${idx < lexemes.length ? lexemes[idx].value : "end of input"}". Tuple expressions in VALUES clause must be enclosed in parentheses.`);
        }

        const openingComments = this.extractLexemeComments(lexemes[idx]);
        idx++;

        const values: ValueComponent[] = [];

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after opening parenthesis in tuple expression.`);
        }

        if (lexemes[idx].type & TokenType.CloseParen) {
            const tuple = new TupleExpression([]);
            const closingComments = this.extractLexemeComments(lexemes[idx]);
            idx++;

            if (openingComments.before.length > 0) {
                tuple.addPositionedComments('before', openingComments.before);
            }
            if (closingComments.after.length > 0) {
                tuple.addPositionedComments('after', closingComments.after);
            }

            return { value: tuple, newIndex: idx };
        }

        const firstValue = ValueParser.parseFromLexeme(lexemes, idx);
        values.push(firstValue.value);
        idx = firstValue.newIndex;

        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++;

            if (idx >= lexemes.length) {
                throw new Error(`Syntax error: Unexpected end of input after comma in tuple expression.`);
            }

            const value = ValueParser.parseFromLexeme(lexemes, idx);
            values.push(value.value);
            idx = value.newIndex;
        }

        if (idx >= lexemes.length || lexemes[idx].type !== TokenType.CloseParen) {
            throw new Error(`Syntax error at position ${idx}: Expected closing parenthesis but found "${idx < lexemes.length ? lexemes[idx].value : "end of input"}". Tuple expressions in VALUES clause must be enclosed in parentheses.`);
        }

        const closingComments = this.extractLexemeComments(lexemes[idx]);
        idx++;

        const tuple = new TupleExpression(values);

        if (openingComments.before.length > 0) {
            tuple.addPositionedComments('before', openingComments.before);
        }
        if (openingComments.after.length > 0 && values.length > 0) {
            values[0].addPositionedComments('before', openingComments.after);
        }
        if (closingComments.before.length > 0 && values.length > 0) {
            values[values.length - 1].addPositionedComments('after', closingComments.before);
        }
        if (closingComments.after.length > 0) {
            tuple.addPositionedComments('after', closingComments.after);
        }

        return { value: tuple, newIndex: idx };
    }

    private static extractLexemeComments(lexeme: Lexeme | undefined): { before: string[]; after: string[] } {
        const before: string[] = [];
        const after: string[] = [];

        if (!lexeme) {
            return { before, after };
        }

        if (lexeme.positionedComments && lexeme.positionedComments.length > 0) {
            for (const positioned of lexeme.positionedComments) {
                if (!positioned.comments || positioned.comments.length === 0) {
                    continue;
                }

                if (positioned.position === 'before') {
                    before.push(...positioned.comments);
                } else if (positioned.position === 'after') {
                    after.push(...positioned.comments);
                }
            }
        } else if (lexeme.comments && lexeme.comments.length > 0) {
            before.push(...lexeme.comments);
        }

        return {
            before: this.dedupeComments(before),
            after: this.dedupeComments(after),
        };
    }

    private static dedupeComments(comments: string[]): string[] {
        if (comments.length <= 1) {
            return comments;
        }

        const seen = new Set<string>();
        const result: string[] = [];

        for (const comment of comments) {
            if (!seen.has(comment)) {
                seen.add(comment);
                result.push(comment);
            }
        }

        return result;
    }
}
