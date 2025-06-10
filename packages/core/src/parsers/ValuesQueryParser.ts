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

        if (lexemes[idx].value.toLowerCase() !== 'values') {
            throw new Error(`Syntax error at position ${idx}: Expected 'VALUES' keyword but found "${lexemes[idx].value}". VALUES clauses must start with the VALUES keyword.`);
        }
        idx++;

        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after 'VALUES' keyword. The VALUES clause requires at least one tuple expression.`);
        }

        const tuples: TupleExpression[] = [];

        // Parse the first tuple
        const firstTuple = this.parseTuple(lexemes, idx);
        tuples.push(firstTuple.value);
        idx = firstTuple.newIndex;

        // Parse additional tuples if they exist
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++; // Skip comma
            const tuple = this.parseTuple(lexemes, idx);
            tuples.push(tuple.value);
            idx = tuple.newIndex;
        }

        const query = new ValuesQuery(tuples);
        return { value: query, newIndex: idx };
    }

    private static parseTuple(lexemes: Lexeme[], index: number): { value: TupleExpression; newIndex: number } {
        let idx = index;

        // Check for opening parenthesis
        if (idx >= lexemes.length || lexemes[idx].type !== TokenType.OpenParen) {
            throw new Error(`Syntax error at position ${idx}: Expected opening parenthesis but found "${idx < lexemes.length ? lexemes[idx].value : "end of input"}". Tuple expressions in VALUES clause must be enclosed in parentheses.`);
        }
        idx++;

        // Parse values inside the tuple
        const values: ValueComponent[] = [];

        // Parse first value
        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input after opening parenthesis in tuple expression.`);
        }

        // Check for empty tuple case
        if (lexemes[idx].type & TokenType.CloseParen) {
            idx++; // Skip closing parenthesis
            return { value: new TupleExpression([]), newIndex: idx };
        }

        // Parse the first value
        const firstValue = ValueParser.parseFromLexeme(lexemes, idx);
        values.push(firstValue.value);
        idx = firstValue.newIndex;

        // Parse additional values
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++; // Skip comma

            if (idx >= lexemes.length) {
                throw new Error(`Syntax error: Unexpected end of input after comma in tuple expression.`);
            }

            const value = ValueParser.parseFromLexeme(lexemes, idx);
            values.push(value.value);
            idx = value.newIndex;
        }

        // Check for closing parenthesis
        if (idx >= lexemes.length || lexemes[idx].type !== TokenType.CloseParen) {
            throw new Error(`Syntax error at position ${idx}: Expected closing parenthesis but found "${idx < lexemes.length ? lexemes[idx].value : "end of input"}". Tuple expressions in VALUES clause must be enclosed in parentheses.`);
        }
        idx++; // Skip closing parenthesis

        return { value: new TupleExpression(values), newIndex: idx };
    }
}