import { OrderByClause, PartitionByClause } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { WindowFrameBound, WindowFrameBoundaryValue, FrameBoundaryComponent, WindowFrameExpression, WindowFrameSpec, WindowFrameType, WindowFrameBoundStatic } from "../models/ValueComponent";
import { OrderByClauseParser } from "./OrderByClauseParser";
import { PartitionByParser } from "./PartitionByParser";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";

export class WindowExpressionParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): WindowFrameExpression {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The window frame expression is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: WindowFrameExpression; newIndex: number } {
        let idx = index;
        if (lexemes[idx].type !== TokenType.OpenParen) {
            throw new Error(`Syntax error at position ${idx}: Expected opening parenthesis '(' but found "${lexemes[idx].value}".`);
        }
        idx++;
        let partition: PartitionByClause | null = null;
        let order: OrderByClause | null = null;
        let frameSpec: WindowFrameSpec | null = null;
        if (idx < lexemes.length && lexemes[idx].value === 'partition by') {
            const partitionResult = PartitionByParser.parseFromLexeme(lexemes, idx);
            partition = partitionResult.value;
            idx = partitionResult.newIndex;
        }
        if (idx < lexemes.length && lexemes[idx].value === 'order by') {
            const orderResult = OrderByClauseParser.parseFromLexeme(lexemes, idx);
            order = orderResult.value;
            idx = orderResult.newIndex;
        }
        // Parse frame clause (ROWS/RANGE/GROUPS)
        if (idx < lexemes.length && this.isFrameTypeKeyword(lexemes[idx].value)) {
            const frameSpecResult = this.parseFrameSpec(lexemes, idx);
            frameSpec = frameSpecResult.value;
            idx = frameSpecResult.newIndex;
        }
        if (idx >= lexemes.length || lexemes[idx].type !== TokenType.CloseParen) {
            throw new Error(`Syntax error at position ${idx}: Missing closing parenthesis ')' for window frame. Each opening parenthesis must have a matching closing parenthesis.`);
        }
        // Read close paren
        idx++;

        return { value: new WindowFrameExpression(partition, order, frameSpec), newIndex: idx };
    }

    private static isFrameTypeKeyword(value: string): boolean {
        const lowerValue = value;
        return lowerValue === 'rows' || lowerValue === 'range' || lowerValue === 'groups';
    }

    private static parseFrameSpec(lexemes: Lexeme[], index: number): { value: WindowFrameSpec; newIndex: number } {
        let idx = index;

        // Determine frame type (ROWS/RANGE/GROUPS)
        const frameTypeStr = lexemes[idx].value;
        let frameType: WindowFrameType;

        switch (frameTypeStr) {
            case 'rows':
                frameType = WindowFrameType.Rows;
                break;
            case 'range':
                frameType = WindowFrameType.Range;
                break;
            case 'groups':
                frameType = WindowFrameType.Groups;
                break;
            default:
                throw new Error(`Syntax error at position ${idx}: Invalid frame type "${lexemes[idx].value}". Expected one of: ROWS, RANGE, GROUPS.`);
        }
        idx++;

        // Check for BETWEEN ... AND ... syntax
        if (idx < lexemes.length && lexemes[idx].value === 'between') {
            // BETWEEN ... AND ... syntax
            idx++;

            // Parse start boundary
            const startBoundResult = this.parseFrameBoundary(lexemes, idx);
            const startBound = startBoundResult.value;
            idx = startBoundResult.newIndex;

            // Check for AND keyword - may be recognized as a separate token or part of a compound token
            if (idx >= lexemes.length || (lexemes[idx].value !== 'and')) {
                throw new Error(`Syntax error at position ${idx}: Expected 'AND' keyword in BETWEEN clause.`);
            }
            idx++; // Skip AND

            // Parse end boundary
            const endBoundResult = this.parseFrameBoundary(lexemes, idx);
            const endBound = endBoundResult.value;
            idx = endBoundResult.newIndex;

            return {
                value: new WindowFrameSpec(frameType, startBound, endBound),
                newIndex: idx
            };
        } else {
            // Single boundary specification
            const boundaryResult = this.parseFrameBoundary(lexemes, idx);
            const startBound = boundaryResult.value;
            idx = boundaryResult.newIndex;

            return {
                value: new WindowFrameSpec(frameType, startBound, null),
                newIndex: idx
            };
        }
    }

    private static parseFrameBoundary(lexemes: Lexeme[], index: number): { value: FrameBoundaryComponent, newIndex: number } {
        let idx = index;
        // Check for predefined boundaries
        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Command)) {
            const currentValue = lexemes[idx].value;
            let frameBound: WindowFrameBound;
            switch (currentValue) {
                case 'current row':
                    frameBound = WindowFrameBound.CurrentRow;
                    break;
                case 'unbounded preceding':
                    frameBound = WindowFrameBound.UnboundedPreceding;
                    break;
                case 'unbounded following':
                    frameBound = WindowFrameBound.UnboundedFollowing;
                    break;
                default:
                    throw new Error(`Syntax error at position ${idx}: Invalid frame type "${lexemes[idx].value}". Expected one of: ROWS, RANGE, GROUPS.`);
            }
            const bound = new WindowFrameBoundStatic(frameBound);
            return { value: bound, newIndex: idx + 1 };
        } else if (idx < lexemes.length && (lexemes[idx].type & TokenType.Literal)) {
            // Parse the numeric/literal value
            const valueResult = ValueParser.parseFromLexeme(lexemes, idx);
            idx = valueResult.newIndex;
            // Next token must be 'preceding' or 'following'
            if (idx < lexemes.length && (lexemes[idx].type & TokenType.Command)) {
                const direction = lexemes[idx].value;
                let isFollowing: boolean;
                if (direction === 'preceding') {
                    isFollowing = false;
                } else if (direction === 'following') {
                    isFollowing = true;
                } else {
                    throw new Error(`Syntax error at position ${idx}: Expected 'preceding' or 'following' after numeric value in window frame boundary.`);
                }
                idx++;
                const bound = new WindowFrameBoundaryValue(valueResult.value, isFollowing);
                return { value: bound, newIndex: idx };
            } else {
                throw new Error(`Syntax error at position ${idx}: Expected 'preceding' or 'following' after numeric value in window frame boundary.`);
            }
        }
        throw new Error(`Syntax error at position ${idx}: Expected a valid frame boundary component.`);
    }
}