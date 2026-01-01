import { CommonTable, CTEQuery } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SqlTokenizer } from "./SqlTokenizer";
import { SelectQueryParser } from "./SelectQueryParser";
import { SourceAliasExpressionParser } from "./SourceAliasExpressionParser";
import { InsertQueryParser } from "./InsertQueryParser";
import { UpdateQueryParser } from "./UpdateQueryParser";
import { DeleteQueryParser } from "./DeleteQueryParser";
import { InsertQuery } from "../models/InsertQuery";
import { UpdateQuery } from "../models/UpdateQuery";
import { DeleteQuery } from "../models/DeleteQuery";
import { SelectQuery } from "../models/SelectQuery";
import { SelectQueryWithClauseHelper } from "../utils/SelectQueryWithClauseHelper";
import { WithClauseParser } from "./WithClauseParser";

export class CommonTableParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): CommonTable {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The CommonTable definition is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: CommonTable; newIndex: number; trailingComments: string[] | null } {
        let idx = index;

        // 1. Parse alias and optional column aliases
        const aliasResult = SourceAliasExpressionParser.parseFromLexeme(lexemes, idx);
        idx = aliasResult.newIndex;

        // 2. Collect preceding comments for this CTE
        this.collectPrecedingComments(lexemes, index, aliasResult);

        // 3. Parse AS keyword
        idx = this.parseAsKeyword(lexemes, idx);

        // 4. Parse optional MATERIALIZED flag
        const { materialized, newIndex: materializedIndex } = this.parseMaterializedFlag(lexemes, idx);
        idx = materializedIndex;

        // 5. Parse inner CTE query with parentheses
        const { query, trailingComments, newIndex: queryIndex } = this.parseInnerQuery(lexemes, idx);
        idx = queryIndex;

        // 6. Create CommonTable instance
        const value = new CommonTable(query, aliasResult.value, materialized);

        return {
            value,
            newIndex: idx,
            trailingComments
        };
    }

    // Collect comments from preceding tokens that should belong to this CTE
    private static collectPrecedingComments(lexemes: Lexeme[], index: number, aliasResult: any): void {
        if (!aliasResult.value?.table) return;

        const cteTable = aliasResult.value.table;

        for (let i = index - 1; i >= 0; i--) {
            const token = lexemes[i];

            // Handle WITH keyword specially - collect its "after" comments for the first CTE
            if (token.value.toLowerCase() === 'with') {
                this.collectWithTokenComments(token, cteTable);
                break; // Stop at WITH keyword
            }

            // Stop looking if we hit a comma (indicates previous CTE) or RECURSIVE keyword
            if (token.type & TokenType.Comma || token.value.toLowerCase() === 'recursive') {
                break;
            }

            // Collect comments from tokens before the CTE name
            this.collectTokenComments(token, cteTable);
        }
    }

    // Collect comments from WITH token
    private static collectWithTokenComments(token: Lexeme, cteTable: any): void {
        let hasPositionedComments = false;

        if (token.positionedComments && token.positionedComments.length > 0) {
            for (const posComment of token.positionedComments) {
                if (posComment.position === 'after' && posComment.comments) {
                    this.addPositionedComment(cteTable, 'before', posComment.comments);
                    hasPositionedComments = true;
                }
            }
        }

        // Only use legacy comments if no positioned comments were found
        if (!hasPositionedComments && token.comments && token.comments.length > 0) {
            this.addPositionedComment(cteTable, 'before', token.comments);
        }
    }

    // Collect comments from a token
    private static collectTokenComments(token: Lexeme, cteTable: any): void {
        if (token.comments && token.comments.length > 0) {
            this.addPositionedComment(cteTable, 'before', token.comments);
        }
        if (token.positionedComments && token.positionedComments.length > 0) {
            if (!cteTable.positionedComments) {
                cteTable.positionedComments = [];
            }
            cteTable.positionedComments.unshift(...token.positionedComments);
        }
    }

    // Helper to add positioned comment
    private static addPositionedComment(cteTable: any, position: string, comments: string[]): void {
        if (!cteTable.positionedComments) {
            cteTable.positionedComments = [];
        }
        cteTable.positionedComments.unshift({
            position,
            comments: [...comments]
        });
    }

    // Parse AS keyword
    private static parseAsKeyword(lexemes: Lexeme[], index: number): number {
        if (index < lexemes.length && lexemes[index].value !== "as") {
            throw new Error(`Syntax error at position ${index}: Expected 'AS' keyword after CTE name but found "${lexemes[index].value}".`);
        }
        return index + 1; // Skip 'AS' keyword
    }

    // Parse optional MATERIALIZED flag
    private static parseMaterializedFlag(lexemes: Lexeme[], index: number): { materialized: boolean | null; newIndex: number } {
        if (index >= lexemes.length) {
            return { materialized: null, newIndex: index };
        }

        const currentValue = lexemes[index].value;
        if (currentValue === "materialized") {
            return { materialized: true, newIndex: index + 1 };
        } else if (currentValue === "not materialized") {
            return { materialized: false, newIndex: index + 1 };
        }

        return { materialized: null, newIndex: index };
    }

    // Parse inner SELECT query with parentheses
    private static parseInnerQuery(lexemes: Lexeme[], index: number): { query: CTEQuery; trailingComments: string[] | null; newIndex: number } {
        let idx = index;

        if (idx < lexemes.length && lexemes[idx].type !== TokenType.OpenParen) {
            throw new Error(`Syntax error at position ${idx}: Expected '(' after CTE name but found "${lexemes[idx].value}".`);
        }

        // Capture comments from the opening parenthesis for the CTE inner query
        const cteQueryHeaderComments = this.extractComments(lexemes[idx]);
        idx++; // Skip opening parenthesis

        const queryResult = this.parseCteQuery(lexemes, idx);
        idx = queryResult.newIndex;

        // Attach comments from the opening parenthesis to the start of the inner query.
        this.applyCteHeaderComments(queryResult.value, cteQueryHeaderComments);

        if (idx < lexemes.length && lexemes[idx].type !== TokenType.CloseParen) {
            throw new Error(`Syntax error at position ${idx}: Expected ')' after CTE query but found "${lexemes[idx].value}".`);
        }

        // Capture comments from the closing parenthesis
        const closingParenComments = this.extractComments(lexemes[idx]);
        idx++; // Skip closing parenthesis

        return {
            query: queryResult.value,
            trailingComments: closingParenComments.length > 0 ? closingParenComments : null,
            newIndex: idx
        };
    }

    private static parseCteQuery(lexemes: Lexeme[], index: number): { value: CTEQuery; newIndex: number } {
        if (index >= lexemes.length) {
            throw new Error(`Syntax error at position ${index}: Expected CTE query but found end of input.`);
        }

        const firstToken = lexemes[index].value.toLowerCase();

        switch (firstToken) {
            case "select":
            case "values":
                return SelectQueryParser.parseFromLexeme(lexemes, index);
            case "insert into":
                return InsertQueryParser.parseFromLexeme(lexemes, index);
            case "update":
                return UpdateQueryParser.parseFromLexeme(lexemes, index);
            case "delete from":
                return DeleteQueryParser.parseFromLexeme(lexemes, index);
            case "with": {
                // Determine statement type after WITH to route to the correct parser.
                const commandAfterWith = this.getCommandAfterWith(lexemes, index);
                switch (commandAfterWith) {
                    case "insert into":
                        return InsertQueryParser.parseFromLexeme(lexemes, index);
                    case "update":
                        return UpdateQueryParser.parseFromLexeme(lexemes, index);
                    case "delete from":
                        return DeleteQueryParser.parseFromLexeme(lexemes, index);
                    default:
                        return SelectQueryParser.parseFromLexeme(lexemes, index);
                }
            }
            default:
                throw new Error(`Syntax error at position ${index}: Expected SELECT, INSERT, UPDATE, DELETE, or WITH in CTE query but found "${lexemes[index].value}".`);
        }
    }

    private static applyCteHeaderComments(query: CTEQuery, headerComments: string[]): void {
        if (headerComments.length === 0) {
            return;
        }

        if (this.isSelectQuery(query)) {
            if (query.headerComments) {
                query.headerComments = [...headerComments, ...query.headerComments];
            } else {
                query.headerComments = headerComments;
            }
            return;
        }

        if (query instanceof InsertQuery) {
            const withClause = SelectQueryWithClauseHelper.getWithClause(query.selectQuery);
            const target = withClause ?? query.insertClause;
            target.addPositionedComments("before", headerComments);
            return;
        }

        if (query instanceof UpdateQuery) {
            const target = query.withClause ?? query.updateClause;
            target.addPositionedComments("before", headerComments);
            return;
        }

        if (query instanceof DeleteQuery) {
            const target = query.withClause ?? query.deleteClause;
            target.addPositionedComments("before", headerComments);
        }
    }

    private static isSelectQuery(query: CTEQuery): query is SelectQuery {
        return "__selectQueryType" in query && (query as SelectQuery).__selectQueryType === "SelectQuery";
    }

    private static getCommandAfterWith(lexemes: Lexeme[], index: number): string | null {
        try {
            const withResult = WithClauseParser.parseFromLexeme(lexemes, index);
            const next = lexemes[withResult.newIndex];
            return next?.value.toLowerCase() ?? null;
        } catch {
            return null;
        }
    }

    // Extract comments from a lexeme (both positioned and legacy)
    private static extractComments(lexeme: Lexeme): string[] {
        const comments: string[] = [];

        // Check positioned comments
        if (lexeme.positionedComments) {
            for (const posComment of lexeme.positionedComments) {
                if (posComment.comments) {
                    comments.push(...posComment.comments);
                }
            }
        }

        // Check legacy comments for backward compatibility
        if (lexeme.comments && lexeme.comments.length > 0) {
            comments.push(...lexeme.comments);
        }

        return comments;
    }
}
