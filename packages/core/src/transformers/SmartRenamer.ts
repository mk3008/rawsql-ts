import { LineColumn } from "../utils/LexemeCursor";
import { LexemeCursor } from "../utils/LexemeCursor";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import { BinarySelectQuery } from "../models/BinarySelectQuery";
import { TokenType } from "../models/Lexeme";
import { CTERenamer } from "./CTERenamer";
import { AliasRenamer } from "./AliasRenamer";

/**
 * Result of smart rename operation
 */
export interface SmartRenameResult {
    success: boolean;
    originalSql: string;
    newSql?: string;
    renamerType: 'cte' | 'alias' | 'unknown';
    originalName: string;
    newName: string;
    error?: string;
}

/**
 * Smart renamer that automatically detects whether to use CTERenamer or AliasRenamer
 * based on the cursor position in SQL text.
 * 
 * This class provides unified GUI integration for SQL renaming operations:
 * - If cursor is on a CTE name → uses CTERenamer
 * - If cursor is on a table alias → uses AliasRenamer  
 * - Auto-detects the type and calls appropriate renamer
 * 
 * @example
 * ```typescript
 * const renamer = new SmartRenamer();
 * const sql = `
 *   WITH user_data AS (SELECT * FROM users u WHERE u.active = true)
 *   SELECT * FROM user_data
 * `;
 * 
 * // Right-click on 'user_data' (CTE name) at line 2, column 8
 * const result = renamer.rename(sql, { line: 2, column: 8 }, 'customer_data');
 * // Uses CTERenamer automatically
 * 
 * // Right-click on 'u' (table alias) at line 2, column 35  
 * const result2 = renamer.rename(sql, { line: 2, column: 35 }, 'usr');
 * // Uses AliasRenamer automatically
 * ```
 */
export class SmartRenamer {
    private cteRenamer: CTERenamer;
    private aliasRenamer: AliasRenamer;

    constructor() {
        this.cteRenamer = new CTERenamer();
        this.aliasRenamer = new AliasRenamer();
    }

    /**
     * Check if the token at the given position is renameable (CTE name or table alias).
     * This is a lightweight check for GUI applications to determine if a rename context menu
     * should be shown when right-clicking.
     * 
     * @param sql - The complete SQL string
     * @param position - Line and column position where user clicked (1-based)
     * @returns Object indicating if renameable and what type of renamer would be used
     */
    public isRenameable(sql: string, position: LineColumn): { 
        renameable: boolean; 
        renamerType: 'cte' | 'alias' | 'none';
        tokenName?: string;
        reason?: string;
    } {
        try {
            // Basic validation
            if (!sql?.trim()) {
                return { renameable: false, renamerType: 'none', reason: 'Empty SQL' };
            }
            if (!position || position.line < 1 || position.column < 1) {
                return { renameable: false, renamerType: 'none', reason: 'Invalid position' };
            }

            // Find lexeme at position
            const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, position);
            if (!lexeme) {
                return { renameable: false, renamerType: 'none', reason: 'No token found' };
            }

            // Must be an identifier or function
            if (!(lexeme.type & (TokenType.Identifier | TokenType.Function))) {
                return { 
                    renameable: false, 
                    renamerType: 'none', 
                    tokenName: lexeme.value,
                    reason: `Token '${lexeme.value}' is not an identifier` 
                };
            }

            const tokenName = lexeme.value;

            // Detect what type of identifier this is
            const renamerType = this.detectRenamerType(sql, tokenName);
            
            if (renamerType === 'unknown') {
                return { 
                    renameable: false, 
                    renamerType: 'none', 
                    tokenName,
                    reason: `Cannot determine if '${tokenName}' is renameable` 
                };
            }

            // Additional check: some identifiers might be column names or other non-renameable items
            // For now, if we can detect it as CTE or potential alias, consider it renameable
            return { 
                renameable: true, 
                renamerType, 
                tokenName 
            };

        } catch (error) {
            return { 
                renameable: false, 
                renamerType: 'none', 
                reason: `Error: ${error instanceof Error ? error.message : String(error)}` 
            };
        }
    }

    /**
     * Automatically detect and rename CTE names or table aliases based on cursor position.
     * 
     * @param sql - The complete SQL string
     * @param position - Line and column position where user clicked (1-based)
     * @param newName - The new name to assign
     * @returns Result object with success status and details
     */
    public rename(sql: string, position: LineColumn, newName: string): SmartRenameResult {
        try {
            // Input validation
            if (!sql?.trim()) {
                return this.createErrorResult(sql, newName, 'unknown', '', 'SQL cannot be empty');
            }
            if (!position || position.line < 1 || position.column < 1) {
                return this.createErrorResult(sql, newName, 'unknown', '', 'Position must be valid line/column (1-based)');
            }
            if (!newName?.trim()) {
                return this.createErrorResult(sql, newName, 'unknown', '', 'New name cannot be empty');
            }

            // Find lexeme at position
            const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, position);
            if (!lexeme) {
                return this.createErrorResult(sql, newName, 'unknown', '', `No identifier found at line ${position.line}, column ${position.column}`);
            }

            // Must be an identifier
            if (!(lexeme.type & TokenType.Identifier)) {
                return this.createErrorResult(sql, newName, 'unknown', lexeme.value, `Token '${lexeme.value}' is not renameable`);
            }

            const originalName = lexeme.value;

            // Try CTE renaming first
            const renamerType = this.detectRenamerType(sql, originalName);
            
            try {
                let newSql: string;
                
                if (renamerType === 'cte') {
                    newSql = this.cteRenamer.renameCTEAtPosition(sql, position, newName);
                } else if (renamerType === 'alias') {
                    const result = this.aliasRenamer.renameAlias(sql, position, newName);
                    if (!result.success) {
                        return {
                            success: false,
                            originalSql: sql,
                            renamerType: 'alias',
                            originalName,
                            newName,
                            error: result.conflicts?.join(', ') || 'Alias rename failed'
                        };
                    }
                    newSql = result.newSql!;
                } else {
                    return this.createErrorResult(sql, newName, 'unknown', originalName, `Cannot determine if '${originalName}' is a CTE name or table alias`);
                }

                return {
                    success: true,
                    originalSql: sql,
                    newSql,
                    renamerType,
                    originalName,
                    newName
                };

            } catch (error) {
                return this.createErrorResult(sql, newName, renamerType, originalName, `${renamerType.toUpperCase()} rename failed: ${error instanceof Error ? error.message : String(error)}`);
            }

        } catch (error) {
            return this.createErrorResult(sql, newName, 'unknown', '', `Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Detect whether an identifier is a CTE name or table alias.
     * @private
     */
    private detectRenamerType(sql: string, identifierName: string): 'cte' | 'alias' | 'unknown' {
        try {
            const query = SelectQueryParser.parse(sql);
            
            // Check if it's a CTE name
            if (this.isCTEName(query, identifierName)) {
                return 'cte';
            }

            // If not a CTE, assume it's a table alias
            // Note: More sophisticated detection could be added here
            return 'alias';

        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Check if identifier is a CTE name in the query.
     * @private
     */
    private isCTEName(query: any, name: string): boolean {
        if (query instanceof SimpleSelectQuery && query.withClause) {
            return query.withClause.tables.some((cte: any) => 
                cte.aliasExpression && cte.aliasExpression.table && cte.aliasExpression.table.name === name
            );
        }
        if (query instanceof BinarySelectQuery) {
            return this.isCTEName(query.left, name) || this.isCTEName(query.right, name);
        }
        return false;
    }

    /**
     * Create error result object.
     * @private
     */
    private createErrorResult(sql: string, newName: string, renamerType: 'cte' | 'alias' | 'unknown', originalName: string, error: string): SmartRenameResult {
        return {
            success: false,
            originalSql: sql,
            renamerType,
            originalName,
            newName,
            error
        };
    }
}