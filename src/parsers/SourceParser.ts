import { FullNameParser } from "./FullNameParser";
import { FunctionSource, SourceComponent, SubQuerySource, TableSource } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SelectQueryParser } from "./SelectQueryParser";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class SourceParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): SourceComponent {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The source component is complete but there are additional tokens.`);
        }

        return result.value;
    }

    /**
     * Parses only a TableSource from the given lexemes, regardless of the presence of parentheses after the identifier.
     * This method is specifically used for cases like INSERT queries (e.g., "insert into table_name (col1, col2)")
     * where a parenthesis immediately following the table name could otherwise be misinterpreted as a function call.
     * By using this method, the parser forcibly treats the source as a TableSource.
     *
     * @param lexemes The array of lexemes to parse.
     * @param index The starting index in the lexeme array.
     * @returns An object containing the parsed TableSource and the new index.
     */
    public static parseTableSourceFromLexemes(lexemes: Lexeme[], index: number): { value: SourceComponent; newIndex: number } {
        return this.parseTableSource(lexemes, index);
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: SourceComponent; newIndex: number } {
        const idx = index;

        // Handle subquery
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.OpenParen)) {
            return this.parseParenSource(lexemes, idx);
        }

        // Handle function-based source
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Function)) {
            return this.parseFunctionSource(lexemes, idx);
        }

        // Handle table source (regular table, potentially schema-qualified)
        return this.parseTableSource(lexemes, idx);
    }

    private static parseTableSource(lexemes: Lexeme[], index: number): { value: TableSource; newIndex: number } {        // Use FullNameParser to robustly parse qualified table names, including escaped and namespaced identifiers.
        const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, index);
        const value = new TableSource(namespaces, name.name);
        return { value, newIndex };
    }

    private static parseFunctionSource(lexemes: Lexeme[], index: number): { value: FunctionSource; newIndex: number } {
        let idx = index;
        const functionName = lexemes[idx].value;
        idx++;

        const argument = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
        idx = argument.newIndex;

        const result = new FunctionSource(functionName, argument.value);
        return { value: result, newIndex: idx };
    }

    private static parseParenSource(lexemes: Lexeme[], index: number): { value: SourceComponent; newIndex: number } {
        let idx = index;
        // skip the open parenthesis
        idx++;
        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input at position ${idx}. Expected a subquery or nested expression after opening parenthesis.`);
        }

        // Support both SELECT and VALUES in subqueries
        const keyword = lexemes[idx].value;
        if (keyword === "select" || keyword === "values" || keyword === "with") {
            const result = this.parseSubQuerySource(lexemes, idx);
            idx = result.newIndex;
            if (idx < lexemes.length && lexemes[idx].type == TokenType.CloseParen) {
                // skip the closing parenthesis
                idx++;
            } else {
                throw new Error(`Syntax error at position ${idx}: Missing closing parenthesis. Each opening parenthesis must have a matching closing parenthesis.`);
            }
            return { value: result.value, newIndex: idx };
        } else if (lexemes[idx].type == TokenType.OpenParen) {
            const result = this.parseParenSource(lexemes, idx);
            idx = result.newIndex;
            if (idx < lexemes.length && lexemes[idx].type == TokenType.CloseParen) {
                // skip the closing parenthesis
                idx++;
            } else {
                throw new Error(`Syntax error at position ${idx}: Missing closing parenthesis. Each opening parenthesis must have a matching closing parenthesis.`);
            }
            return { value: result.value, newIndex: idx };
        }

        throw new Error(`Syntax error at position ${idx}: Expected 'SELECT' keyword, 'VALUES' keyword, or opening parenthesis '(' but found "${lexemes[idx].value}".`);
    }

    private static parseSubQuerySource(lexemes: Lexeme[], index: number): { value: SubQuerySource; newIndex: number } {
        let idx = index;

        // Use the new parseFromLexeme method and destructure the result
        const { value: selectQuery, newIndex } = SelectQueryParser.parseFromLexeme(lexemes, idx);
        idx = newIndex;

        const subQuerySource = new SubQuerySource(selectQuery);
        return { value: subQuerySource, newIndex: idx };
    }
}
