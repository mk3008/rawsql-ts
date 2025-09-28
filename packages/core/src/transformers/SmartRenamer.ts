import { LineColumn } from "../utils/LexemeCursor";
import { LexemeCursor } from "../utils/LexemeCursor";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import { BinarySelectQuery } from "../models/BinarySelectQuery";
import { TokenType } from "../models/Lexeme";
import { CTERenamer } from "./CTERenamer";
import { AliasRenamer } from "./AliasRenamer";
import { SqlIdentifierRenamer } from "./SqlIdentifierRenamer";

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
    // Formatting preservation info (added for integrated functionality)
    formattingPreserved?: boolean;
    formattingMethod?: 'sql-identifier-renamer' | 'smart-renamer-only';
}

/**
 * Smart renamer that detects whether a cursor points to a CTE or table alias and routes to the correct renamer.
 *
 * - CTE targets use CTERenamer so dependency graphs stay consistent.
 * - Table aliases use AliasRenamer with scope detection.
 * - Optional formatting preservation uses SqlIdentifierRenamer.
 *
 * @example
 * ```typescript
 * const renamer = new SmartRenamer();
 * const sql = `WITH user_data AS (SELECT * FROM users) SELECT * FROM user_data`;
 *
 * const result = renamer.rename(sql, { line: 1, column: 8 }, 'customer_data');
 *
 * if (result.success) {
 *   console.log(result.newSql);
 * }
 * ```
 * Related tests: packages/core/tests/transformers/SmartRenamer.demo.test.ts
 */
export class SmartRenamer {
    private cteRenamer: CTERenamer;
    private aliasRenamer: AliasRenamer;
    private identifierRenamer: SqlIdentifierRenamer;

    constructor() {
        this.cteRenamer = new CTERenamer();
        this.aliasRenamer = new AliasRenamer();
        this.identifierRenamer = new SqlIdentifierRenamer();
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
     * @param options - Optional configuration { preserveFormatting?: boolean }
     * @returns Result object with success status and details
     */
    public rename(sql: string, position: LineColumn, newName: string, options?: { preserveFormatting?: boolean }): SmartRenameResult {
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
            const preserveFormatting = options?.preserveFormatting ?? false;

            // Detect the renamer type
            const renamerType = this.detectRenamerType(sql, originalName);
            
            // If formatting preservation is requested, try that approach first
            if (preserveFormatting) {
                try {
                    const formatPreservedResult = this.attemptFormattingPreservationRename(sql, position, newName, originalName, renamerType);
                    if (formatPreservedResult.success) {
                        return formatPreservedResult;
                    }
                } catch (error) {
                    // Log error but continue with fallback approach
                    console.warn('Formatting preservation failed, falling back to standard rename:', error);
                }
            }
            
            // Standard rename approach (no formatting preservation)
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
                            error: result.conflicts?.join(', ') || 'Alias rename failed',
                            formattingPreserved: false,
                            formattingMethod: 'smart-renamer-only'
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
                    newName,
                    formattingPreserved: false,
                    formattingMethod: 'smart-renamer-only'
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
     * Attempts to perform rename using SqlIdentifierRenamer to preserve formatting.
     * @private
     */
    private attemptFormattingPreservationRename(
        sql: string, 
        position: LineColumn, 
        newName: string, 
        originalName: string, 
        renamerType: 'cte' | 'alias' | 'unknown'
    ): SmartRenameResult {
        // First, use standard renaming to validate the operation
        const standardResult = this.performStandardRename(sql, position, newName, originalName, renamerType);
        
        if (!standardResult.success) {
            return {
                ...standardResult,
                formattingPreserved: false,
                formattingMethod: 'smart-renamer-only'
            };
        }

        // Create rename mapping for format restorer
        const renameMap = new Map([[originalName, newName]]);

        try {
            // Use SqlIdentifierRenamer to apply the rename while preserving formatting
            const formattedSql = this.identifierRenamer.renameIdentifiers(sql, renameMap);

            // Validate that the rename was successful
            if (this.validateRenameResult(sql, formattedSql, originalName, newName)) {
                return {
                    success: true,
                    originalSql: sql,
                    newSql: formattedSql,
                    renamerType,
                    originalName,
                    newName,
                    formattingPreserved: true,
                    formattingMethod: 'sql-identifier-renamer'
                };
            } else {
                throw new Error('Validation failed: rename may not have been applied correctly');
            }

        } catch (error) {
            // Return standard result on formatting preservation failure
            return {
                ...standardResult,
                formattingPreserved: false,
                formattingMethod: 'smart-renamer-only'
            };
        }
    }

    /**
     * Perform standard rename without formatting preservation
     * @private
     */
    private performStandardRename(
        sql: string, 
        position: LineColumn, 
        newName: string, 
        originalName: string, 
        renamerType: 'cte' | 'alias' | 'unknown'
    ): SmartRenameResult {
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
                return {
                    success: false,
                    originalSql: sql,
                    renamerType: 'unknown',
                    originalName,
                    newName,
                    error: `Cannot determine if '${originalName}' is a CTE name or table alias`
                };
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
            return {
                success: false,
                originalSql: sql,
                renamerType,
                originalName,
                newName,
                error: `${renamerType.toUpperCase()} rename failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Validates that the rename operation was successful
     * @private
     */
    private validateRenameResult(originalSql: string, newSql: string, oldName: string, newName: string): boolean {
        // Basic validation: new SQL should be different from original
        if (originalSql === newSql) {
            return false;
        }

        // The new name should appear in the result
        if (!newSql.includes(newName)) {
            return false;
        }

        // The new SQL should have fewer occurrences of the old name than the original
        const originalOccurrences = this.countWordOccurrences(originalSql, oldName);
        const newOccurrences = this.countWordOccurrences(newSql, oldName);
        
        return newOccurrences < originalOccurrences;
    }

    /**
     * Counts word boundary occurrences of a name in SQL
     * @private
     */
    private countWordOccurrences(sql: string, name: string): number {
        const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = sql.match(regex);
        return matches ? matches.length : 0;
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
            error,
            formattingPreserved: false,
            formattingMethod: 'smart-renamer-only'
        };
    }

    /**
     * Batch rename multiple identifiers with optional formatting preservation.
     * 
     * @param sql - The complete SQL string  
     * @param renames - Map of old names to new names
     * @param options - Optional configuration { preserveFormatting?: boolean }
     * @returns Result with success status and details
     */
    public batchRename(
        sql: string, 
        renames: Record<string, string>,
        options?: { preserveFormatting?: boolean }
    ): SmartRenameResult {
        const preserveFormatting = options?.preserveFormatting ?? false;

        if (preserveFormatting) {
            try {
                const renameMap = new Map(Object.entries(renames));
                const formattedSql = this.identifierRenamer.renameIdentifiers(sql, renameMap);

                const originalNames = Object.keys(renames);
                const newNames = Object.values(renames);

                return {
                    success: true,
                    originalSql: sql,
                    newSql: formattedSql,
                    renamerType: 'alias', // Assume alias for batch operations
                    originalName: originalNames.join(', '),
                    newName: newNames.join(', '),
                    formattingPreserved: true,
                    formattingMethod: 'sql-identifier-renamer'
                };

            } catch (error) {
                return {
                    success: false,
                    originalSql: sql,
                    renamerType: 'unknown',
                    originalName: Object.keys(renames).join(', '),
                    newName: Object.values(renames).join(', '),
                    error: `Batch rename failed: ${error instanceof Error ? error.message : String(error)}`,
                    formattingPreserved: false,
                    formattingMethod: 'smart-renamer-only'
                };
            }
        } else {
            // Standard batch rename without formatting preservation would need implementation
            // For now, return error suggesting individual renames
            return {
                success: false,
                originalSql: sql,
                renamerType: 'unknown',
                originalName: Object.keys(renames).join(', '),
                newName: Object.values(renames).join(', '),
                error: 'Batch rename without formatting preservation not implemented. Use individual renames or enable formatting preservation.',
                formattingPreserved: false,
                formattingMethod: 'smart-renamer-only'
            };
        }
    }
}
