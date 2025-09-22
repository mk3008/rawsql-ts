import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, TypeValue, UnaryExpression, ValueComponent, ValueList, BinaryExpression, CastExpression, ArraySliceExpression, ArrayIndexExpression } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { IdentifierParser } from "./IdentifierParser";
import { LiteralParser } from "./LiteralParser";
import { ParenExpressionParser } from "./ParenExpressionParser";
import { UnaryExpressionParser } from "./UnaryExpressionParser";
import { ParameterExpressionParser } from "./ParameterExpressionParser";
import { StringSpecifierExpressionParser } from "./StringSpecifierExpressionParser";
import { CommandExpressionParser } from "./CommandExpressionParser";
import { FunctionExpressionParser } from "./FunctionExpressionParser";
import { FullNameParser } from "./FullNameParser";
import { ParseError } from "./ParseError";
import { OperatorPrecedence } from "../utils/OperatorPrecedence";

export class ValueParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): ValueComponent {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw ParseError.fromUnparsedLexemes(
                lexemes,
                result.newIndex,
                `[ValueParser]`
            );
        }

        return result.value;
    }

    /**
     * Parse from lexeme array with logical operator controls
     */
    public static parseFromLexeme(lexemes: Lexeme[], index: number, allowAndOperator: boolean = true, allowOrOperator: boolean = true): { value: ValueComponent; newIndex: number } {
        return this.parseExpressionWithPrecedence(lexemes, index, 0, allowAndOperator, allowOrOperator);
    }

    /**
     * Parse expressions with operator precedence handling
     * Uses precedence climbing algorithm
     */
    private static parseExpressionWithPrecedence(
        lexemes: Lexeme[],
        index: number,
        minPrecedence: number,
        allowAndOperator: boolean = true,
        allowOrOperator: boolean = true
    ): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Parse the primary expression (left side)
        const comment = lexemes[idx].comments;
        const positionedComments = lexemes[idx].positionedComments;
        const left = this.parseItem(lexemes, idx);
        
        // Transfer positioned comments if they exist and the component doesn't handle its own comments
        if (positionedComments && positionedComments.length > 0 && !left.value.positionedComments) {
            left.value.positionedComments = positionedComments;
        }
        // Fall back to legacy comments if positioned comments aren't available
        else if (left.value.comments === null && comment && comment.length > 0) {
            left.value.comments = comment;
        }
        idx = left.newIndex;

        let result = left.value;

        // Handle postfix array access ([...])
        const arrayAccessResult = this.parseArrayAccess(lexemes, idx, result);
        result = arrayAccessResult.value;
        idx = arrayAccessResult.newIndex;

        // Process operators with precedence
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Operator)) {
            const operatorToken = lexemes[idx];
            const operator = operatorToken.value;

            // Check if this operator is allowed
            if (!allowAndOperator && operator.toLowerCase() === "and") {
                break;
            }
            if (!allowOrOperator && operator.toLowerCase() === "or") {
                break;
            }

            // Get operator precedence
            const precedence = OperatorPrecedence.getPrecedence(operator);

            // If this operator has lower precedence than minimum, stop
            if (precedence < minPrecedence) {
                break;
            }

            idx++; // consume operator            // Handle BETWEEN specially as it has different syntax
            if (OperatorPrecedence.isBetweenOperator(operator)) {
                const betweenResult = FunctionExpressionParser.parseBetweenExpression(
                    lexemes, idx, result, operator.toLowerCase().includes('not')
                );
                result = betweenResult.value;
                idx = betweenResult.newIndex;
                continue;
            }

            // Handle :: (cast) operator specially
            if (operator === "::") {
                const typeValue = FunctionExpressionParser.parseTypeValue(lexemes, idx);
                result = new CastExpression(result, typeValue.value);
                idx = typeValue.newIndex;
                continue;
            }

            // For left-associative operators, use precedence + 1
            const nextMinPrecedence = precedence + 1;

            // Parse the right-hand side with higher precedence
            const rightResult = this.parseExpressionWithPrecedence(
                lexemes, idx, nextMinPrecedence, allowAndOperator, allowOrOperator
            );
            idx = rightResult.newIndex;

            // Create binary expression with operator comments preserved
            const binaryExpr = new BinaryExpression(result, operator, rightResult.value);
            // Transfer operator token comments to the operator RawString
            if (operatorToken.comments && operatorToken.comments.length > 0) {
                binaryExpr.operator.comments = operatorToken.comments;
            }
            if (operatorToken.positionedComments && operatorToken.positionedComments.length > 0) {
                binaryExpr.operator.positionedComments = operatorToken.positionedComments;
            }
            result = binaryExpr;
        }

        return { value: result, newIndex: idx };
    }

    /**
     * Transfer positioned comments from lexeme to value component if the component doesn't already handle them
     */
    private static transferPositionedComments(lexeme: Lexeme, value: ValueComponent): void {
        if (lexeme.positionedComments && lexeme.positionedComments.length > 0 && !value.positionedComments) {
            value.positionedComments = lexeme.positionedComments;
        }
        // Fall back to legacy comments if positioned comments aren't available
        else if (value.comments === null && lexeme.comments && lexeme.comments.length > 0) {
            value.comments = lexeme.comments;
        }
    }

    private static parseItem(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Range check
        if (idx >= lexemes.length) {
            throw new Error(`Unexpected end of lexemes at index ${index}`);
        }

        const current = lexemes[idx];

        if (current.type & TokenType.Identifier && current.type & TokenType.Operator && current.type & TokenType.Type) {
            // Check if this is followed by parentheses (function call)
            if (idx + 1 < lexemes.length && (lexemes[idx + 1].type & TokenType.OpenParen)) {
                // Determine if this is a type constructor or function call
                if (this.isTypeConstructor(lexemes, idx + 1, current.value)) {
                    // Type constructor
                    const result = FunctionExpressionParser.parseTypeValue(lexemes, idx);
                    this.transferPositionedComments(current, result.value);
                    return { value: result.value, newIndex: result.newIndex };
                } else {
                    // Function call
                    const result = FunctionExpressionParser.parseFromLexeme(lexemes, idx);
                    this.transferPositionedComments(current, result.value);
                    return result;
                }
            }
            // Typed literal format pattern
            // e.g., `interval '2 days'`
            const first = IdentifierParser.parseFromLexeme(lexemes, idx);
            if (first.newIndex >= lexemes.length) {
                this.transferPositionedComments(current, first.value);
                return first;
            }
            const next = lexemes[first.newIndex];
            if (next.type & TokenType.Literal) {
                // Typed literal format
                const second = LiteralParser.parseFromLexeme(lexemes, first.newIndex);
                const result = new UnaryExpression(lexemes[idx].value, second.value);
                this.transferPositionedComments(current, result);
                return { value: result, newIndex: second.newIndex };
            }
            this.transferPositionedComments(current, first.value);
            return first;
        } else if (current.type & TokenType.Identifier) {
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            // Namespace is also recognized as Identifier.
            // Since functions and types, as well as columns (tables), can have namespaces,
            // it is necessary to determine by the last element of the identifier.
            if (lexemes[newIndex - 1].type & TokenType.Function) {
                const result = FunctionExpressionParser.parseFromLexeme(lexemes, idx);
                this.transferPositionedComments(current, result.value);
                return result;
            } else if (lexemes[newIndex - 1].type & TokenType.Type) {
                // Handle Type tokens that also have Identifier flag
                if (newIndex < lexemes.length && (lexemes[newIndex].type & TokenType.OpenParen)) {
                    // Determine if this is a type constructor or function call
                    if (this.isTypeConstructor(lexemes, newIndex, name.name)) {
                        // Type constructor (NUMERIC(10,2), VARCHAR(50), etc.)
                        const result = FunctionExpressionParser.parseTypeValue(lexemes, idx);
                        this.transferPositionedComments(current, result.value);
                        return { value: result.value, newIndex: result.newIndex };
                    } else {
                        // Function call (DATE('2025-01-01'), etc.)
                        const result = FunctionExpressionParser.parseFromLexeme(lexemes, idx);
                        this.transferPositionedComments(current, result.value);
                        return result;
                    }
                } else {
                    // Handle standalone type tokens
                    const value = new TypeValue(namespaces, name);
                    this.transferPositionedComments(current, value);
                    return { value, newIndex };
                }
            }
            const value = new ColumnReference(namespaces, name);
            this.transferPositionedComments(current, value);
            return { value, newIndex };
        } else if (current.type & TokenType.Literal) {
            const result = LiteralParser.parseFromLexeme(lexemes, idx);
            this.transferPositionedComments(current, result.value);
            return result;
        } else if (current.type & TokenType.OpenParen) {
            const result = ParenExpressionParser.parseFromLexeme(lexemes, idx);
            this.transferPositionedComments(current, result.value);
            return result;
        } else if (current.type & TokenType.Function) {
            const result = FunctionExpressionParser.parseFromLexeme(lexemes, idx);
            this.transferPositionedComments(current, result.value);
            return result;
        } else if (current.type & TokenType.Operator) {
            const result = UnaryExpressionParser.parseFromLexeme(lexemes, idx);
            this.transferPositionedComments(current, result.value);
            return result;
        } else if (current.type & TokenType.Parameter) {
            const result = ParameterExpressionParser.parseFromLexeme(lexemes, idx);
            this.transferPositionedComments(current, result.value);
            return result;
        } else if (current.type & TokenType.StringSpecifier) {
            const result = StringSpecifierExpressionParser.parseFromLexeme(lexemes, idx);
            this.transferPositionedComments(current, result.value);
            return result;
        } else if (current.type & TokenType.Command) {
            const result = CommandExpressionParser.parseFromLexeme(lexemes, idx);
            this.transferPositionedComments(current, result.value);
            return result;
        } else if (current.type & TokenType.OpenBracket) {
            // SQLServer escape identifier format. e.g. [dbo] or [dbo].[table]
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            const value = new ColumnReference(namespaces, name);
            this.transferPositionedComments(current, value);
            return { value, newIndex };
        } else if (current.type & TokenType.Type) {
            // Check if this type token is followed by an opening parenthesis
            const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
            if (newIndex < lexemes.length && (lexemes[newIndex].type & TokenType.OpenParen)) {
                // Determine if this is a type constructor or function call
                if (this.isTypeConstructor(lexemes, newIndex, name.name)) {
                    // Type constructor (NUMERIC(10,2), VARCHAR(50), etc.)
                    const result = FunctionExpressionParser.parseTypeValue(lexemes, idx);
                    this.transferPositionedComments(current, result.value);
                    return { value: result.value, newIndex: result.newIndex };
                } else {
                    // Function call (DATE('2025-01-01'), etc.)
                    const result = FunctionExpressionParser.parseFromLexeme(lexemes, idx);
                    this.transferPositionedComments(current, result.value);
                    return result;
                }
            } else {
                // Handle standalone type tokens
                const value = new TypeValue(namespaces, name);
                this.transferPositionedComments(current, value);
                return { value, newIndex };
            }
        }

        throw ParseError.fromUnparsedLexemes(lexemes, idx, `[ValueParser] Invalid lexeme.`);
    }

    public static parseArgument(openToken: TokenType, closeToken: TokenType, lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        const args: ValueComponent[] = [];

        // Check for opening parenthesis
        if (idx < lexemes.length && lexemes[idx].type === openToken) {
            // Capture comments from opening parenthesis
            const openParenToken = lexemes[idx];
            idx++;

            if (idx < lexemes.length && lexemes[idx].type === closeToken) {
                // If there are no arguments, return an empty ValueList
                idx++;
                return { value: new ValueList([]), newIndex: idx };
            }

            // If the next element is `*`, treat `*` as an Identifier
            if (idx < lexemes.length && lexemes[idx].value === "*") {
                const wildcard = new ColumnReference(null, "*");
                // Transfer opening paren comments to wildcard
                if (openParenToken.positionedComments && openParenToken.positionedComments.length > 0) {
                    // Convert "after" positioned comments from opening paren to "before" comments for the argument
                    const beforeComments = openParenToken.positionedComments.filter(pc => pc.position === 'after');
                    if (beforeComments.length > 0) {
                        wildcard.positionedComments = beforeComments.map(pc => ({
                            position: 'before' as const,
                            comments: pc.comments
                        }));
                    }
                } else if (openParenToken.comments && openParenToken.comments.length > 0) {
                    wildcard.comments = openParenToken.comments;
                }
                idx++;
                // The next element must be closeToken
                if (idx < lexemes.length && lexemes[idx].type === closeToken) {
                    idx++;
                    return { value: wildcard, newIndex: idx };
                } else {
                    throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected closing parenthesis after wildcard '*'.`);
                }
            }

            // Parse the value inside
            const result = this.parseFromLexeme(lexemes, idx);
            idx = result.newIndex;
            
            // Transfer opening paren comments to the first argument
            if (openParenToken.positionedComments && openParenToken.positionedComments.length > 0) {
                // Convert "after" positioned comments from opening paren to "before" comments for the argument
                const afterComments = openParenToken.positionedComments.filter(pc => pc.position === 'after');
                if (afterComments.length > 0) {
                    const beforeComments = afterComments.map(pc => ({
                        position: 'before' as const,
                        comments: pc.comments
                    }));
                    
                    // Merge with existing positioned comments
                    if (result.value.positionedComments) {
                        result.value.positionedComments = [...beforeComments, ...result.value.positionedComments];
                    } else {
                        result.value.positionedComments = beforeComments;
                    }
                }
            } else if (openParenToken.comments && openParenToken.comments.length > 0) {
                // Fall back to legacy comments
                if (result.value.comments) {
                    result.value.comments = openParenToken.comments.concat(result.value.comments);
                } else {
                    result.value.comments = openParenToken.comments;
                }
            }
            
            args.push(result.value);

            // Continue reading if the next element is a comma
            while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
                idx++;
                const argResult = this.parseFromLexeme(lexemes, idx);
                idx = argResult.newIndex;
                args.push(argResult.value);
            }

            // Check for closing parenthesis
            if (idx < lexemes.length && lexemes[idx].type === closeToken) {
                idx++;
                if (args.length === 1) {
                    // Return as is if there is only one argument
                    return { value: args[0], newIndex: idx };
                }
                // Create ValueCollection if there are multiple arguments
                const value = new ValueList(args);
                return { value, newIndex: idx };
            } else {
                throw ParseError.fromUnparsedLexemes(lexemes, idx, `Missing closing parenthesis.`);
            }
        }

        throw ParseError.fromUnparsedLexemes(lexemes, index, `Expected opening parenthesis.`);
    }

    /**
     * Parse postfix array access operations [index] or [start:end]
     * @param lexemes Array of lexemes
     * @param index Current index
     * @param baseExpression The base expression to apply array access to
     * @returns Result with potentially modified expression and new index
     */
    private static parseArrayAccess(lexemes: Lexeme[], index: number, baseExpression: ValueComponent): { value: ValueComponent; newIndex: number } {
        let idx = index;
        let result = baseExpression;

        // Check for array access syntax [...]
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.OpenBracket)) {
            // Check if this is SQL Server bracket identifier by looking ahead
            if (this.isSqlServerBracketIdentifier(lexemes, idx)) {
                break; // This is SQL Server bracket syntax, not array access
            }

            idx++; // consume opening bracket

            if (idx >= lexemes.length) {
                throw new Error(`Expected array index or slice after '[' at index ${idx - 1}`);
            }

            // Check for empty brackets []
            if (lexemes[idx].type & TokenType.CloseBracket) {
                throw new Error(`Empty array access brackets not supported at index ${idx}`);
            }

            // First, check if this is a slice by looking for colon pattern
            let startExpr: ValueComponent | null = null;
            let isSlice = false;

            // Parse the first part (could be start of slice or single index)
            if (lexemes[idx].type & TokenType.Operator && lexemes[idx].value === ":") {
                // Starts with colon [:end] - start is null
                isSlice = true;
                idx++; // consume colon
            } else {
                // Parse the first expression (but with higher precedence than colon)
                const colonPrecedence = OperatorPrecedence.getPrecedence(":");
                const firstResult = this.parseExpressionWithPrecedence(lexemes, idx, colonPrecedence + 1);
                startExpr = firstResult.value;
                idx = firstResult.newIndex;

                // Check if next token is colon
                if (idx < lexemes.length && lexemes[idx].type & TokenType.Operator && lexemes[idx].value === ":") {
                    isSlice = true;
                    idx++; // consume colon
                }
            }

            if (isSlice) {
                // This is a slice expression [start:end]
                let endExpr: ValueComponent | null = null;

                // Check if there's an end expression or if it's an open slice like [1:]
                if (idx < lexemes.length && !(lexemes[idx].type & TokenType.CloseBracket)) {
                    const colonPrecedence = OperatorPrecedence.getPrecedence(":");
                    const endResult = this.parseExpressionWithPrecedence(lexemes, idx, colonPrecedence + 1);
                    endExpr = endResult.value;
                    idx = endResult.newIndex;
                }

                // Expect closing bracket
                if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.CloseBracket)) {
                    throw new Error(`Expected ']' after array slice at index ${idx}`);
                }
                idx++; // consume closing bracket

                // Create ArraySliceExpression
                result = new ArraySliceExpression(result, startExpr, endExpr);
            } else {
                // This is a single index access [index]
                // Need to parse the full expression if it wasn't already parsed
                if (!startExpr) {
                    const indexResult = this.parseFromLexeme(lexemes, idx);
                    startExpr = indexResult.value;
                    idx = indexResult.newIndex;
                }
                
                // Expect closing bracket
                if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.CloseBracket)) {
                    throw new Error(`Expected ']' after array index at index ${idx}`);
                }
                idx++; // consume closing bracket

                // Create ArrayIndexExpression
                result = new ArrayIndexExpression(result, startExpr!);
            }
        }

        return { value: result, newIndex: idx };
    }

    /**
     * Check if the bracket at the given index represents SQL Server bracket identifier syntax
     * Returns true if this looks like [identifier] or [schema].[table] syntax
     */
    private static isSqlServerBracketIdentifier(lexemes: Lexeme[], bracketIndex: number): boolean {
        let idx = bracketIndex + 1; // Start after opening bracket

        if (idx >= lexemes.length) return false;

        // SQL Server bracket identifiers should contain only identifiers and dots
        while (idx < lexemes.length && !(lexemes[idx].type & TokenType.CloseBracket)) {
            const token = lexemes[idx];
            
            // Allow identifiers and dots in SQL Server bracket syntax
            if ((token.type & TokenType.Identifier) || 
                (token.type & TokenType.Operator && token.value === ".")) {
                idx++;
                continue;
            }
            
            // If we find anything else (numbers, expressions, colons), it's array access
            return false;
        }

        // If we reached the end without finding a closing bracket, it's malformed
        if (idx >= lexemes.length) return false;

        // If the closing bracket is immediately followed by a dot, it's likely SQL Server syntax
        // like [dbo].[table] 
        const closingBracketIndex = idx;
        if (closingBracketIndex + 1 < lexemes.length) {
            const nextToken = lexemes[closingBracketIndex + 1];
            if (nextToken.type & TokenType.Operator && nextToken.value === ".") {
                return true;
            }
        }

        // Check if the content looks like a simple identifier (no colons, expressions, etc.)
        idx = bracketIndex + 1;
        let hasOnlyIdentifiersAndDots = true;
        while (idx < closingBracketIndex) {
            const token = lexemes[idx];
            if (!((token.type & TokenType.Identifier) || 
                  (token.type & TokenType.Operator && token.value === "."))) {
                hasOnlyIdentifiersAndDots = false;
                break;
            }
            idx++;
        }

        // If it contains only identifiers and dots, it's likely SQL Server syntax
        return hasOnlyIdentifiersAndDots;
    }

    /**
     * Determines if a type token followed by parentheses is a type constructor or function call
     * @param lexemes Array of lexemes
     * @param openParenIndex Index of the opening parenthesis
     * @param typeName Name of the type/function
     * @returns True if this is a type constructor, false if it's a function call
     */
    private static isTypeConstructor(lexemes: Lexeme[], openParenIndex: number, typeName: string): boolean {
        // These are always type constructors regardless of content
        const alwaysTypeConstructors = [
            'NUMERIC', 'DECIMAL', 'VARCHAR', 'CHAR', 'CHARACTER',
            'TIMESTAMP', 'TIME', 'INTERVAL'
        ];
        
        const upperTypeName = typeName.toUpperCase();
        if (alwaysTypeConstructors.includes(upperTypeName)) {
            return true;
        }
        
        // For DATE, check if the first argument is a string literal (function) or not (type)
        if (upperTypeName === 'DATE') {
            const firstArgIndex = openParenIndex + 1;
            if (firstArgIndex < lexemes.length) {
                const firstArg = lexemes[firstArgIndex];
                const isStringLiteral = (firstArg.type & TokenType.Literal) && 
                                       typeof firstArg.value === 'string' &&
                                       isNaN(Number(firstArg.value));
                // If first argument is a string literal, it's a function call
                // DATE('2025-01-01') -> function
                // DATE(6) -> type constructor
                return !isStringLiteral;
            }
        }
        
        // Default: assume it's a function call for ambiguous cases
        return false;
    }
}
