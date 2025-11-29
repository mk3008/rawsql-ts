import { Lexeme, TokenType } from "../models/Lexeme";
import { FunctionCall, ValueComponent, BinaryExpression, TypeValue, CastExpression, BetweenExpression, RawString, ArrayExpression, ArrayQueryExpression, ValueList, ColumnReference } from "../models/ValueComponent";
import { SelectQuery } from "../models/SelectQuery";
import { OrderByClause } from "../models/Clause";
import { OverExpressionParser } from "./OverExpressionParser";
import { ValueParser } from "./ValueParser";
import { FullNameParser } from "./FullNameParser";
import { SelectQueryParser } from "./SelectQueryParser";
import { OrderByClauseParser } from "./OrderByClauseParser";
import { ParseError } from "./ParseError";
import { extractLexemeComments } from "./utils/LexemeCommentUtils";

export class FunctionExpressionParser {
    /**
     * Aggregate functions that support internal ORDER BY clause
     */
    private static readonly AGGREGATE_FUNCTIONS_WITH_ORDER_BY = new Set([
        'string_agg', 'array_agg', 'json_agg', 'jsonb_agg', 
        'json_object_agg', 'jsonb_object_agg', 'xmlagg'
    ]);

    /**
     * Parse ARRAY expressions - handles both ARRAY[...] (literal) and ARRAY(...) (query) syntax
     * @param lexemes Array of lexemes to parse
     * @param index Current parsing index
     * @returns Parsed array expression and new index
     */
    private static parseArrayExpression(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Check if this is array literal (ARRAY[...]) or function call (ARRAY(...))
        if (idx + 1 < lexemes.length && (lexemes[idx + 1].type & TokenType.OpenBracket)) {
            idx++;
            const arg = ValueParser.parseArgument(TokenType.OpenBracket, TokenType.CloseBracket, lexemes, idx);
            idx = arg.newIndex;
            const value = new ArrayExpression(arg.value);
            return { value, newIndex: idx };
        } else if (idx + 1 < lexemes.length && (lexemes[idx + 1].type & TokenType.OpenParen)) {
            idx++;
            idx++; // Skip the opening parenthesis
            const arg = SelectQueryParser.parseFromLexeme(lexemes, idx);
            idx = arg.newIndex;
            idx++; // Skip the closing parenthesis
            const value = new ArrayQueryExpression(arg.value);
            return { value, newIndex: idx };
        }

        throw new Error(`Invalid ARRAY syntax at index ${idx}, expected ARRAY[... or ARRAY(...)`);
    }

    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        const current = lexemes[idx];

        if (current.value === "array") {
            return this.parseArrayExpression(lexemes, idx);
        } else if (current.value === "substring" || current.value === "overlay") {
            return this.parseKeywordFunction(lexemes, idx, [
                { key: "from", required: false },
                { key: "for", required: false }
            ]);
        } else if (current.value === "cast") {
            return this.parseKeywordFunction(lexemes, idx, [
                { key: "as", required: true }
            ]);
        } else if (current.value === "trim") {
            return this.parseKeywordFunction(lexemes, idx, [
                { key: "from", required: false }
            ]);
        }

        return this.parseFunctionCall(lexemes, idx);
    }

    public static tryParseBinaryExpression(lexemes: Lexeme[], index: number, left: ValueComponent, allowAndOperator: boolean = true, allowOrOperator: boolean = true): { value: ValueComponent; newIndex: number } | null {
        let idx = index;

        // If the next element is an operator, process it as a binary expression
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Operator)) {
            const operator = lexemes[idx].value.toLowerCase();

            if (!allowAndOperator && operator === "and") {
                // Handle special case for "and" operator
                return null;
            }

            if (!allowOrOperator && operator === "or") {
                // Handle special case for "or" operator
                return null;
            }

            idx++;

            // between
            if (operator === "between") {
                return this.parseBetweenExpression(lexemes, idx, left, false);
            } else if (operator === "not between") {
                return this.parseBetweenExpression(lexemes, idx, left, true);
            }

            // ::
            if (operator === "::") {
                const typeValue = this.parseTypeValue(lexemes, idx);
                idx = typeValue.newIndex;
                const exp = new CastExpression(left, typeValue.value);
                return { value: exp, newIndex: idx };
            }

            // Get the right-hand side value
            const rightResult = ValueParser.parseFromLexeme(lexemes, idx);
            idx = rightResult.newIndex;

            // Create binary expression
            const value = new BinaryExpression(left, operator, rightResult.value);
            return { value, newIndex: idx };
        }

        return null;
    }

    public static parseBetweenExpression(lexemes: Lexeme[], index: number, value: ValueComponent, negated: boolean): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        const lower = ValueParser.parseFromLexeme(lexemes, idx, false);
        idx = lower.newIndex;

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Operator) && lexemes[idx].value !== "and") {
            throw new Error(`Expected 'and' after 'between' at index ${idx}`);
        }
        idx++;

        // Parse upper bound with restricted scope - stop at logical operators
        const upper = this.parseBetweenUpperBound(lexemes, idx);
        idx = upper.newIndex;
        const result = new BetweenExpression(value, lower.value, upper.value, negated);
        return { value: result, newIndex: idx };
    }

    /**
     * Parse the upper bound of a BETWEEN expression with logical operator precedence
     * This stops parsing when it encounters AND/OR operators at the same level
     */
    private static parseBetweenUpperBound(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        // Parse with higher precedence than AND/OR to ensure BETWEEN binds tighter
        // Use precedence 3 (higher than AND=2, OR=1) as minimum to stop at logical operators
        return ValueParser.parseFromLexeme(lexemes, index, false, false);
    }

    private static parseFunctionCall(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;
        // Parse namespaced function name (e.g., myschema.myfunc, dbo.util.myfunc)
        // Use FullNameParser to get namespaces and function name
        const fullNameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const namespaces = fullNameResult.namespaces;
        const name = fullNameResult.name;
        idx = fullNameResult.newIndex;

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.OpenParen)) {
            // Check if this is an aggregate function that supports internal ORDER BY
            const functionName = name.name.toLowerCase();
            let arg: { value: ValueComponent; newIndex: number };
            let closingComments: string[] | null = null;
            
            let internalOrderBy: OrderByClause | null = null;
            
            if (this.AGGREGATE_FUNCTIONS_WITH_ORDER_BY.has(functionName)) {
                // Use special aggregate function argument parser with comment capture
                const result = this.parseAggregateArguments(lexemes, idx);
                arg = { value: result.arguments, newIndex: result.newIndex };
                internalOrderBy = result.orderByClause;
                closingComments = result.closingComments;
            } else {
                // General argument parsing with comment capture
                const argWithComments = this.parseArgumentWithComments(lexemes, idx);
                arg = { value: argWithComments.value, newIndex: argWithComments.newIndex };
                closingComments = argWithComments.closingComments;
            }
            idx = arg.newIndex;

            // Check for WITHIN GROUP clause
            let withinGroup: OrderByClause | null = null;
            if (idx < lexemes.length && lexemes[idx].value === "within group") {
                const withinGroupResult = this.parseWithinGroupClause(lexemes, idx);
                withinGroup = withinGroupResult.value;
                idx = withinGroupResult.newIndex;
            }

            // Check for FILTER clause that applies a WHERE predicate to the aggregate
            let filterCondition: ValueComponent | null = null;
            if (idx < lexemes.length && lexemes[idx].value === "filter") {
                const filterResult = this.parseFilterClause(lexemes, idx);
                filterCondition = filterResult.condition;
                idx = filterResult.newIndex;
            }

            // Check for WITH ORDINALITY clause
            let withOrdinality = false;
            if (idx < lexemes.length && lexemes[idx].value === "with ordinality") {
                withOrdinality = true;
                idx++; // Skip single "with ordinality" token
            }

            if (idx < lexemes.length && lexemes[idx].value === "over") {
                const over = OverExpressionParser.parseFromLexeme(lexemes, idx);
                idx = over.newIndex;
                const value = new FunctionCall(namespaces, name.name, arg.value, over.value, withinGroup, withOrdinality, internalOrderBy, filterCondition);
                // Set closing comments if available
                if (closingComments && closingComments.length > 0) {
                    value.addPositionedComments("after", closingComments);
                }
                return { value, newIndex: idx };
            } else {
                const value = new FunctionCall(namespaces, name.name, arg.value, null, withinGroup, withOrdinality, internalOrderBy, filterCondition);
                // Set closing comments if available
                if (closingComments && closingComments.length > 0) {
                    value.addPositionedComments("after", closingComments);
                }
                return { value, newIndex: idx };
            }
        } else {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected opening parenthesis after function name '${name.name}'.`);
        }
    }

    private static parseKeywordFunction(
        lexemes: Lexeme[],
        index: number,
        keywords: { key: string, required: boolean }[]
    ): { value: ValueComponent; newIndex: number; } {
        let idx = index;
        // Parse function name and namespaces at the beginning for consistent usage
        const fullNameResult = FullNameParser.parseFromLexeme(lexemes, idx);
        const namespaces = fullNameResult.namespaces;
        const name = fullNameResult.name;
        idx = fullNameResult.newIndex;

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.OpenParen)) {
            idx++;

            const input = ValueParser.parseFromLexeme(lexemes, idx);
            let arg = input.value;
            idx = input.newIndex;

            // Delegate to the standard function parser if parsing by comma
            if (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
                return this.parseFunctionCall(lexemes, index);
            }

            // Check for required/optional keywords in function arguments
            for (const { key, required } of keywords) {
                if (idx < lexemes.length && (lexemes[idx].type & TokenType.Command) && lexemes[idx].value === key) {
                    idx++;

                    if (idx < lexemes.length && (lexemes[idx].type & TokenType.Type)) {
                        const typeValue = this.parseTypeValue(lexemes, idx);
                        arg = new BinaryExpression(arg, key, typeValue.value);
                        idx = typeValue.newIndex;
                    } else {
                        const right = ValueParser.parseFromLexeme(lexemes, idx);
                        arg = new BinaryExpression(arg, key, right.value);
                        idx = right.newIndex;
                    }

                } else if (required) {
                    throw ParseError.fromUnparsedLexemes(lexemes, idx, `Keyword '${key}' is required for ${name.name} function.`);
                }
            }

            if (idx < lexemes.length && (lexemes[idx].type & TokenType.CloseParen)) {
                idx++;
                
                // Check for WITHIN GROUP clause
                let withinGroup: OrderByClause | null = null;
                if (idx < lexemes.length && lexemes[idx].value === "within group") {
                    const withinGroupResult = this.parseWithinGroupClause(lexemes, idx);
                    withinGroup = withinGroupResult.value;
                    idx = withinGroupResult.newIndex;
                }

                // Check for WITH ORDINALITY clause
                let withOrdinality = false;
                if (idx < lexemes.length && lexemes[idx].value === "with ordinality") {
                    withOrdinality = true;
                    idx++; // Skip single "with ordinality" token
                }
                
                // Use the previously parsed namespaces and function name for consistency
                if (idx < lexemes.length && lexemes[idx].value === "over") {
                    idx++;
                    const over = OverExpressionParser.parseFromLexeme(lexemes, idx);
                    idx = over.newIndex;
                    const value = new FunctionCall(namespaces, name.name, arg, over.value, withinGroup, withOrdinality, null);
                    return { value, newIndex: idx };
                } else {
                    const value = new FunctionCall(namespaces, name.name, arg, null, withinGroup, withOrdinality, null);
                    return { value, newIndex: idx };
                }
            } else {
                throw ParseError.fromUnparsedLexemes(lexemes, idx, `Missing closing parenthesis for function '${name.name}'.`);
            }
        } else {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Missing opening parenthesis for function '${name.name}'.`);
        }
    }

    public static parseTypeValue(lexemes: Lexeme[], index: number): { value: TypeValue; newIndex: number; } {
        let idx = index;

        const { namespaces, name, newIndex } = FullNameParser.parseFromLexeme(lexemes, idx);
        idx = newIndex;

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.OpenParen)) {
            const arg = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            idx = arg.newIndex;
            const value = new TypeValue(namespaces, new RawString(name.name), arg.value);
            // Transfer positioned comments from the argument to the function
            if (arg.value.positionedComments) {
                value.positionedComments = arg.value.positionedComments;
            }
            if (arg.value.comments) {
                value
            }
            return { value, newIndex: idx };
        } else {
            const value = new TypeValue(namespaces, new RawString(name.name));
            return { value, newIndex: idx };
        }
    }

    /**
     * Parse WITHIN GROUP (ORDER BY ...) clause
     * @param lexemes Array of lexemes to parse
     * @param index Current parsing index (should point to "WITHIN GROUP")
     * @returns Parsed OrderByClause and new index
     */
    private static parseWithinGroupClause(lexemes: Lexeme[], index: number): { value: OrderByClause; newIndex: number } {
        let idx = index;

        // Expect "WITHIN GROUP" (now a single token)
        if (idx >= lexemes.length || lexemes[idx].value !== "within group") {
            throw new Error(`Expected 'WITHIN GROUP' at index ${idx}`);
        }
        idx++;

        // Expect "("
        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.OpenParen)) {
            throw new Error(`Expected '(' after 'WITHIN GROUP' at index ${idx}`);
        }
        idx++;

        // Parse ORDER BY clause
        const orderByResult = OrderByClauseParser.parseFromLexeme(lexemes, idx);
        idx = orderByResult.newIndex;

        // Expect ")"
        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.CloseParen)) {
            throw new Error(`Expected ')' after WITHIN GROUP ORDER BY clause at index ${idx}`);
        }
        idx++;

        return { value: orderByResult.value, newIndex: idx };
    }

    private static parseFilterClause(lexemes: Lexeme[], index: number): { condition: ValueComponent; newIndex: number } {
        let idx = index;

        // Confirm the FILTER keyword is present before processing the clause.
        if (idx >= lexemes.length || lexemes[idx].value !== "filter") {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected 'FILTER' keyword.`);
        }
        idx++;

        // Expect parentheses surrounding the WHERE predicate.
        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.OpenParen)) {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected '(' after FILTER.`);
        }
        idx++;

        // Require the WHERE keyword inside the FILTER clause.
        if (idx >= lexemes.length || lexemes[idx].value !== "where") {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected 'WHERE' inside FILTER clause.`);
        }
        idx++;

        // Parse the predicate inside the FILTER clause and stop at the closing parenthesis.
        const conditionResult = ValueParser.parseFromLexeme(lexemes, idx);
        idx = conditionResult.newIndex;

        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.CloseParen)) {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected ')' after FILTER predicate.`);
        }
        idx++;

        return { condition: conditionResult.value, newIndex: idx };
    }

    /**
     * Parse arguments for aggregate functions that support internal ORDER BY
     * Handles patterns like: string_agg(expr, separator ORDER BY sort_expr)
     * @param lexemes Array of lexemes to parse
     * @param index Current parsing index (should point to opening parenthesis)
     * @returns Parsed arguments, ORDER BY clause, closing parenthesis comments, and new index
     */
    private static parseAggregateArguments(lexemes: Lexeme[], index: number): { arguments: ValueComponent; orderByClause: OrderByClause | null; closingComments: string[] | null; newIndex: number } {
        let idx = index;
        const args: ValueComponent[] = [];
        let orderByClause: OrderByClause | null = null;

        // Check for opening parenthesis
        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.OpenParen)) {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected opening parenthesis.`);
        }
        idx++;

        // Handle empty arguments
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.CloseParen)) {
            const closingComments = this.getClosingComments(lexemes[idx]);
            idx++;
            return { arguments: new ValueList([]), orderByClause: null, closingComments, newIndex: idx };
        }

        // Handle wildcard case
        if (idx < lexemes.length && lexemes[idx].value === "*") {
            const wildcard = new ColumnReference(null, "*");
            idx++;
            if (idx < lexemes.length && (lexemes[idx].type & TokenType.CloseParen)) {
                const closingComments = this.getClosingComments(lexemes[idx]);
                idx++;
                return { arguments: wildcard, orderByClause: null, closingComments, newIndex: idx };
            } else {
                throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected closing parenthesis after wildcard '*'.`);
            }
        }

        // Parse first argument
        const firstArg = ValueParser.parseFromLexeme(lexemes, idx);
        idx = firstArg.newIndex;
        args.push(firstArg.value);

        // Parse additional arguments separated by comma, or ORDER BY
        while (idx < lexemes.length && 
               ((lexemes[idx].type & TokenType.Comma) || lexemes[idx].value === "order by")) {
            
            // Check if current token is ORDER BY (without comma)
            if (lexemes[idx].value === "order by") {
                // Parse ORDER BY clause
                const orderByResult = OrderByClauseParser.parseFromLexeme(lexemes, idx);
                idx = orderByResult.newIndex;
                orderByClause = orderByResult.value;
                break; // ORDER BY should be the last element in aggregate functions
            }
            
            if (lexemes[idx].type & TokenType.Comma) {
                idx++; // Skip comma
                
                // Check if next token after comma is ORDER BY
                if (idx < lexemes.length && lexemes[idx].value === "order by") {
                    // Parse ORDER BY clause
                    const orderByResult = OrderByClauseParser.parseFromLexeme(lexemes, idx);
                    idx = orderByResult.newIndex;
                    orderByClause = orderByResult.value;
                    break; // ORDER BY should be the last element in aggregate functions
                }
                
                // Parse regular argument after comma
                const argResult = ValueParser.parseFromLexeme(lexemes, idx);
                idx = argResult.newIndex;
                args.push(argResult.value);
            }
        }

        // Check for closing parenthesis and capture comments
        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.CloseParen)) {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected closing parenthesis.`);
        }
        const closingComments = this.getClosingComments(lexemes[idx]);
        idx++;

        // Return single argument if only one, otherwise return ValueList
        const argumentsValue = args.length === 1 ? args[0] : new ValueList(args);
        return { arguments: argumentsValue, orderByClause, closingComments, newIndex: idx };
    }

    /**
     * Parse function arguments and capture closing parenthesis comments
     * @param lexemes Array of lexemes to parse
     * @param index Current parsing index (should point to opening parenthesis)
     * @returns Parsed arguments, closing parenthesis comments, and new index
     */
    private static parseArgumentWithComments(lexemes: Lexeme[], index: number): { 
        value: ValueComponent; 
        closingComments: string[] | null; 
        newIndex: number 
    } {
        let idx = index;
        
        // Check for opening parenthesis and capture its comments
        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.OpenParen)) {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected opening parenthesis.`);
        }
        const openParenToken = lexemes[idx];
        idx++; // Skip opening parenthesis
        
        const args: ValueComponent[] = [];
        
        // Check for empty parentheses
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.CloseParen)) {
            const closingComments = this.getClosingComments(lexemes[idx]);
            idx++; // Skip closing parenthesis
            return { value: new ValueList([]), closingComments, newIndex: idx };
        }
        
        // Handle wildcard case: count(*)
        if (idx < lexemes.length && lexemes[idx].value === "*") {
            const wildcard = new ColumnReference(null, "*");
            idx++;
            
            // Check for closing parenthesis
            if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.CloseParen)) {
                throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected closing parenthesis after wildcard '*'.`);
            }
            const closingComments = this.getClosingComments(lexemes[idx]);
            idx++;
            return { value: wildcard, closingComments, newIndex: idx };
        }
        
        // Parse regular arguments
        const result = ValueParser.parseFromLexeme(lexemes, idx);
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
                
                // Merge positioned comments (don't convert legacy comments since they're already positioned)
                result.value.positionedComments = [
                    ...beforeComments,
                    ...(result.value.positionedComments || [])
                ];
                
                // Clear legacy comments to prevent duplication
                result.value
                
                // Also clear positioned comments from nested components to prevent duplication
                // This is needed because both the outer component and inner components might have the same comments
                if ('qualifiedName' in result.value && result.value.qualifiedName) {
                    if ('name' in result.value.qualifiedName && result.value.qualifiedName.name) {
                        result.value.qualifiedName.name.positionedComments = null;
                        result.value.qualifiedName.name
                    }
                }
            }
        }
        
        args.push(result.value);
        
        // Continue reading if the next element is a comma
        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++;
            const argResult = ValueParser.parseFromLexeme(lexemes, idx);
            idx = argResult.newIndex;
            args.push(argResult.value);
        }
        
        // Check for closing parenthesis
        if (idx >= lexemes.length || !(lexemes[idx].type & TokenType.CloseParen)) {
            throw ParseError.fromUnparsedLexemes(lexemes, idx, `Expected closing parenthesis.`);
        }
        const closingComments = this.getClosingComments(lexemes[idx]);
        idx++;

        // Return single argument if only one, otherwise return ValueList
        const argumentsValue = args.length === 1 ? args[0] : new ValueList(args);
        return { value: argumentsValue, closingComments, newIndex: idx };
    }
    /**
     * Normalize closing parenthesis comments to preserve positioned and legacy comment metadata.
     */
    private static getClosingComments(lexeme: Lexeme | undefined): string[] | null {
        if (!lexeme) {
            return null;
        }

        const commentInfo = extractLexemeComments(lexeme);
        if (commentInfo.after.length > 0) {
            return commentInfo.after;
        }
        if (commentInfo.before.length > 0) {
            return commentInfo.before;
        }

        return null;
    }
}

