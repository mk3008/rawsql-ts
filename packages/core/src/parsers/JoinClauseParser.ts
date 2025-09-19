import { JoinClause, SourceExpression } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { joinkeywordParser } from "../tokenReaders/CommandTokenReader";
import { SourceExpressionParser } from "./SourceExpressionParser";
import { JoinOnClauseParser } from "./JoinOnClauseParser";
import { JoinUsingClauseParser } from "./JoinUsingClauseParser";

export class JoinClauseParser {
    public static tryParse(lexemes: Lexeme[], index: number): { value: JoinClause[]; newIndex: number } | null {
        let idx = index;
        const joins: JoinClause[] = [];

        while (this.isJoinCommand(lexemes, idx)) {
            const joinClause = this.parseJoinClause(lexemes, idx);
            joins.push(joinClause.value);
            idx = joinClause.newIndex;
        }

        if (joins.length > 0) {
            return { value: joins, newIndex: idx };
        }
        return null;
    }

    private static isJoinKeyword(value: string): boolean {
        // Although performance is not ideal,
        // we use keyword token reader to centralize keyword management
        const result = joinkeywordParser.parse(value, 0);
        if (result) {
            return true;
        }
        return false;
    }

    private static parseLateral(lexemes: Lexeme[], index: number): { value: boolean; newIndex: number } {
        let idx = index;

        if (idx < lexemes.length && lexemes[idx].value === 'lateral') {
            // Skip 'lateral' keyword
            idx++;
            return { value: true, newIndex: idx };
        }

        return { value: false, newIndex: idx };
    }

    private static isJoinCommand(lexemes: Lexeme[], index: number): boolean {
        if (index >= lexemes.length) {
            return false;
        }

        if (lexemes[index].type & TokenType.Comma || this.isJoinKeyword(lexemes[index].value) === true) {
            return true;
        }
        return false;
    }

    private static parseJoinClause(lexemes: Lexeme[], index: number): { value: JoinClause; newIndex: number } {
        let idx = index;

        // Extract JOIN keyword and comments
        const { joinType, joinComments, newIndex: joinIndex } = this.parseJoinKeyword(lexemes, idx);
        idx = joinIndex;

        // Parse lateral join
        const lateralResult = this.parseLateral(lexemes, idx);
        const lateral = lateralResult.value;
        idx = lateralResult.newIndex;

        // Parse the source expression to join with
        const sourceResult = SourceExpressionParser.parseFromLexeme(lexemes, idx);
        idx = sourceResult.newIndex;

        // Try to parse join condition (ON or USING)
        const joinClause = this.parseJoinCondition(lexemes, idx, joinType, sourceResult.value, lateral, joinComments);
        if (joinClause) {
            return joinClause;
        }

        // Natural join (no condition)
        const naturalJoinClause = new JoinClause(joinType, sourceResult.value, null, lateral);
        this.applyJoinComments(naturalJoinClause, joinComments);
        return { value: naturalJoinClause, newIndex: idx };
    }

    // Extract JOIN keyword and its comments
    private static parseJoinKeyword(lexemes: Lexeme[], index: number): { joinType: string; joinComments: any; newIndex: number } {
        const joinType = lexemes[index].value === "," ? "cross join" : lexemes[index].value;
        const joinComments = this.extractJoinKeywordComments(lexemes[index]);
        return { joinType, joinComments, newIndex: index + 1 };
    }

    // Extract comments from JOIN keyword token
    private static extractJoinKeywordComments(token: Lexeme): { positioned: any; legacy: string[] | null } {
        return {
            positioned: token.positionedComments && token.positionedComments.length > 0 ? token.positionedComments : null,
            legacy: token.comments && token.comments.length > 0 ? token.comments : null
        };
    }

    // Parse join condition (ON or USING)
    private static parseJoinCondition(lexemes: Lexeme[], index: number, joinType: string, sourceValue: any, lateral: boolean, joinComments: any): { value: JoinClause; newIndex: number } | null {
        if (index >= lexemes.length) return null;

        // Try JoinOnClauseParser
        const onResult = JoinOnClauseParser.tryParse(lexemes, index);
        if (onResult) {
            const joinClause = new JoinClause(joinType, sourceValue, onResult.value, lateral);
            this.applyJoinComments(joinClause, joinComments);
            return { value: joinClause, newIndex: onResult.newIndex };
        }

        // Try JoinUsingClauseParser
        const usingResult = JoinUsingClauseParser.tryParse(lexemes, index);
        if (usingResult) {
            const joinClause = new JoinClause(joinType, sourceValue, usingResult.value, lateral);
            this.applyJoinComments(joinClause, joinComments);
            return { value: joinClause, newIndex: usingResult.newIndex };
        }

        return null;
    }

    // Apply comments to JoinClause directly (no collection then assignment)
    private static applyJoinComments(joinClause: JoinClause, joinComments: any): void {
        if (joinComments.positioned) {
            (joinClause as any).joinKeywordPositionedComments = joinComments.positioned;
        } else if (joinComments.legacy) {
            (joinClause as any).joinKeywordComments = joinComments.legacy;
        }
    }
}