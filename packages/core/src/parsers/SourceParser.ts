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
        const fullNameResult = FullNameParser.parseFromLexeme(lexemes, index);
        return this.parseTableSource(fullNameResult);
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: SourceComponent; newIndex: number } {
        let idx = index;

        // Handle subquery
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.OpenParen)) {
            return this.parseParenSource(lexemes, idx);
        }

        // Retrieve the full name only once and reuse the result
        const fullNameResult = FullNameParser.parseFromLexeme(lexemes, idx);

        // Handle function-based source (determine by lastTokenType)
        if (fullNameResult.lastTokenType & TokenType.Function) {
            // Also use fullNameResult as argument for parseFunctionSource
            return SourceParser.parseFunctionSource(lexemes, fullNameResult);
        }

        // Handle table source (regular table, potentially schema-qualified)
        return SourceParser.parseTableSource(fullNameResult);
    }

    private static parseTableSource(fullNameResult: { namespaces: string[] | null, name: any, newIndex: number }): { value: TableSource; newIndex: number } {
        const { namespaces, name, newIndex } = fullNameResult;
        const value = new TableSource(namespaces, name.name);
        
        // Transfer positioned comments from the table name to TableSource
        if (name.positionedComments && name.positionedComments.length > 0) {
            value.positionedComments = name.positionedComments;
        } else if (name.comments && name.comments.length > 0) {
            value.comments = name.comments;
        }
        
        return { value, newIndex };
    }

    private static parseFunctionSource(
        lexemes: Lexeme[],
        fullNameResult: { namespaces: string[] | null, name: any, newIndex: number }
    ): { value: FunctionSource; newIndex: number } {
        let idx = fullNameResult.newIndex;
        const { namespaces, name } = fullNameResult;

        const argument = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
        idx = argument.newIndex;

        let withOrdinality = false;
        if (idx < lexemes.length && lexemes[idx].value === "with ordinality") {
            withOrdinality = true;
            idx++;
        }

        const functionName = name.name;
        const result = new FunctionSource({ namespaces: namespaces, name: functionName }, argument.value, withOrdinality);
        return { value: result, newIndex: idx };
    }

    private static parseParenSource(lexemes: Lexeme[], index: number): { value: SourceComponent; newIndex: number } {
        let idx = index;
        // capture the open parenthesis and its comments
        const openParenToken = lexemes[idx];
        // skip the open parenthesis
        idx++;
        if (idx >= lexemes.length) {
            throw new Error(`Syntax error: Unexpected end of input at position ${idx}. Expected a subquery or nested expression after opening parenthesis.`);
        }

        // Support both SELECT and VALUES in subqueries
        const keyword = lexemes[idx].value;
        if (keyword === "select" || keyword === "values" || keyword === "with") {
            const result = this.parseSubQuerySource(lexemes, idx, openParenToken);
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

    private static parseSubQuerySource(lexemes: Lexeme[], index: number, openParenToken?: Lexeme): { value: SubQuerySource; newIndex: number } {
        let idx = index;

        // Use the new parseFromLexeme method and destructure the result
        const { value: selectQuery, newIndex } = SelectQueryParser.parseFromLexeme(lexemes, idx);
        idx = newIndex;

        // Transfer opening paren comments to the subquery (similar to function arguments)
        if (openParenToken && openParenToken.positionedComments && openParenToken.positionedComments.length > 0) {
            // Convert "after" positioned comments from opening paren to "before" comments for the subquery
            const afterComments = openParenToken.positionedComments.filter(pc => pc.position === 'after');
            if (afterComments.length > 0) {
                const beforeComments = afterComments.map(pc => ({
                    position: 'before' as const,
                    comments: pc.comments
                }));
                
                // Merge with existing positioned comments on the subquery
                if (selectQuery.positionedComments) {
                    selectQuery.positionedComments = [...beforeComments, ...selectQuery.positionedComments];
                } else {
                    selectQuery.positionedComments = beforeComments;
                }
                
                // Clear legacy comments to prevent duplication
                if (selectQuery.comments) {
                    selectQuery.comments = null;
                }
            }
        }

        const subQuerySource = new SubQuerySource(selectQuery);
        return { value: subQuerySource, newIndex: idx };
    }
}
