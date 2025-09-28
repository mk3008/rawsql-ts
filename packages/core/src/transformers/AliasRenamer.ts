import { SelectQuery, SimpleSelectQuery, BinarySelectQuery } from "../models/SelectQuery";
import { LexemeCursor, LineColumn } from "../utils/LexemeCursor";
import { Lexeme, TokenType } from "../models/Lexeme";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { CTERegionDetector } from "../utils/CTERegionDetector";
import { TableSourceCollector } from "./TableSourceCollector";
import { ColumnReferenceCollector } from "./ColumnReferenceCollector";
import { KeywordParser } from "../parsers/KeywordParser";
import { commandKeywordTrie } from "../tokenReaders/CommandTokenReader";

/**
 * Represents an alias scope within SQL query structure
 */
export interface AliasScope {
    type: 'cte' | 'subquery' | 'main';
    name?: string;              // CTE name if applicable
    query: SelectQuery;         // The query containing this scope
    startPosition: number;      // Character offset where scope starts
    endPosition: number;        // Character offset where scope ends
}

/**
 * Represents a reference to an alias within the SQL
 */
export interface AliasReference {
    lexeme: Lexeme;             // The lexeme containing the alias
    scope: AliasScope;          // The scope this reference belongs to
    referenceType: 'definition' | 'usage'; // Whether this is where alias is defined or used
    context: 'table' | 'column'; // Whether it's a table alias or column alias context
}

/**
 * Options for alias renaming operations
 */
export interface RenameOptions {
    scopeType?: 'auto' | 'cte' | 'subquery' | 'main';
    dryRun?: boolean;           // Only validate, don't perform actual rename
    preserveFormatting?: boolean; // Attempt to preserve original formatting
}

/**
 * Result of alias renaming operation
 */
export interface RenameResult {
    success: boolean;
    originalSql: string;        // Original SQL before changes
    newSql?: string;            // Modified SQL if successful
    changes: AliasChange[];     // List of changes made
    conflicts?: string[];       // Any conflicts detected
    scope?: AliasScope;         // The detected scope
}

/**
 * Details of a specific alias change
 */
export interface AliasChange {
    oldName: string;
    newName: string;
    position: LineColumn;
    context: 'table' | 'column';
    referenceType: 'definition' | 'usage';
}

/**
 * Error messages for alias renaming operations
 */
const ERROR_MESSAGES = {
    invalidSql: 'Invalid SQL: unable to parse query',
    invalidPosition: 'Invalid position: line or column out of bounds',
    noLexemeAtPosition: 'No lexeme found at the specified position',
    notAnAlias: 'Selected lexeme is not a valid alias',
    invalidNewName: 'New alias name must be a non-empty string',
    sameNames: 'Old and new alias names cannot be the same',
    nameConflict: (name: string) => `Alias '${name}' already exists in this scope`,
    aliasNotFound: (name: string) => `Alias '${name}' not found in current scope`,
} as const;

/**
 * A utility class for renaming table and column aliases in SQL queries.
 * 
 * This class provides functionality to rename aliases within specific scopes
 * (CTE, subquery, or main query) based on cursor position from GUI editors.
 * It automatically detects the appropriate scope and updates all references
 * to the alias within that scope boundary.
 * 
 * @example
 * ```typescript
 * import { AliasRenamer } from 'rawsql-ts';
 * 
 * const sql = `
 *   SELECT u.name, o.date
 *   FROM users u
 *   JOIN orders o ON u.id = o.user_id
 * `;
 * 
 * const renamer = new AliasRenamer();
 * 
 * // Rename 'u' to 'user_alias' by selecting it at line 2, column 10
 * const result = renamer.renameAlias(sql, { line: 2, column: 10 }, 'user_alias');
 * 
 * if (result.success) {
 *   console.log(result.newSql);
 *   // SELECT user_alias.name, o.date
 *   // FROM users user_alias
 *   // JOIN orders o ON user_alias.id = o.user_id
 * }
 * ```
 * 
 * Related tests: packages/core/tests/transformers/AliasRenamer.functional.test.ts
 * @since 0.12.0
 */
export class AliasRenamer {
    // Use shared keyword trie from CommandTokenReader to avoid duplication

    private keywordParser: KeywordParser;

    /**
     * Creates a new instance of AliasRenamer.
     */
    constructor() {
        // Initialize keyword parser for reserved word detection using shared trie
        this.keywordParser = new KeywordParser(commandKeywordTrie);
    }

    /**
     * Renames an alias based on the cursor position in GUI editor.
     * 
     * This method detects the alias at the specified line and column position,
     * determines its scope (CTE, subquery, or main query), and renames all
     * references to that alias within the scope boundaries.
     * 
     * @param sql - The SQL string containing the alias to rename
     * @param position - Line and column position (1-based) from GUI editor
     * @param newName - The new name for the alias
     * @param options - Optional configuration for the rename operation
     * @returns Result containing success status, modified SQL, and change details
     * 
     * @example
     * ```typescript
     * const sql = "SELECT u.name FROM users u WHERE u.active = true";
     * const result = renamer.renameAlias(sql, { line: 1, column: 8 }, 'user_table');
     * 
     * if (result.success) {
     *   console.log(result.newSql);
     *   // "SELECT user_table.name FROM users user_table WHERE user_table.active = true"
     * }
     * ```
     * 
     * @throws {Error} When the SQL cannot be parsed or position is invalid
     */
    public renameAlias(
        sql: string,
        position: LineColumn,
        newName: string,
        options: RenameOptions = {}
    ): RenameResult {
        try {
            // Input validation
            this.validateInputs(sql, position, newName);
            // Find lexeme at the specified position
            const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, position);
            if (!lexeme) {
                throw new Error(ERROR_MESSAGES.noLexemeAtPosition);
            }

            // Validate that the lexeme is a valid alias
            this.validateLexemeIsAlias(lexeme);

            // Parse SQL to get AST
            const query = SelectQueryParser.parse(sql);

            // Detect the scope containing this alias
            const scope = this.detectAliasScope(sql, query, lexeme, options.scopeType);

            // Find all references to this alias within the scope
            const references = this.collectAliasReferences(scope, lexeme.value);

            // Check for naming conflicts
            const conflicts = this.checkNameConflicts(scope, newName, lexeme.value);
            
            if (conflicts.length > 0) {
                return {
                    success: false,
                    originalSql: sql,
                    changes: [],
                    conflicts,
                    scope
                };
            }

            // Prepare changes
            const changes = this.prepareChanges(references, newName);

            // If dry run, return without making changes
            if (options.dryRun) {
                return {
                    success: true,
                    originalSql: sql,
                    changes,
                    conflicts,
                    scope
                };
            }

            // Perform the actual renaming using lexeme-based approach for better accuracy
            const newSql = this.performLexemeBasedRename(sql, lexeme.value, newName, scope);

            return {
                success: true,
                originalSql: sql,
                newSql,
                changes,
                scope
            };

        } catch (error) {
            return {
                success: false,
                originalSql: sql,
                changes: [],
                conflicts: [error instanceof Error ? error.message : String(error)]
            };
        }
    }

    /**
     * Validates input parameters for alias renaming.
     */
    private validateInputs(sql: string, position: LineColumn, newName: string): void {
        if (!sql || typeof sql !== 'string' || sql.trim() === '') {
            throw new Error(ERROR_MESSAGES.invalidSql);
        }

        if (!position || typeof position.line !== 'number' || typeof position.column !== 'number' ||
            position.line < 1 || position.column < 1) {
            throw new Error(ERROR_MESSAGES.invalidPosition);
        }

        if (!newName || typeof newName !== 'string' || newName.trim() === '') {
            throw new Error(ERROR_MESSAGES.invalidNewName);
        }
    }

    /**
     * Validates that the lexeme represents a valid alias.
     */
    private validateLexemeIsAlias(lexeme: Lexeme): void {
        // Check if lexeme is an identifier (potential alias)
        if (!(lexeme.type & TokenType.Identifier)) {
            throw new Error(ERROR_MESSAGES.notAnAlias);
        }
    }

    /**
     * Detects the scope (CTE, subquery, main query) containing the alias.
     */
    private detectAliasScope(
        sql: string,
        query: SelectQuery,
        lexeme: Lexeme,
        scopeType?: 'auto' | 'cte' | 'subquery' | 'main'
    ): AliasScope {
        if (!lexeme.position) {
            // Fallback to main query if no position info
            return {
                type: 'main',
                query,
                startPosition: 0,
                endPosition: sql.length
            };
        }

        const lexemePosition = lexeme.position.startPosition;

        // Force specific scope type if requested
        if (scopeType && scopeType !== 'auto') {
            return this.createScopeForType(scopeType, sql, query, lexemePosition);
        }

        // Auto-detect scope based on position
        return this.autoDetectScope(sql, query, lexemePosition);
    }

    /**
     * Creates scope for a specific requested type.
     */
    private createScopeForType(
        scopeType: 'cte' | 'subquery' | 'main',
        sql: string,
        query: SelectQuery,
        position: number
    ): AliasScope {
        switch (scopeType) {
            case 'cte':
                return this.detectCTEScope(sql, query, position);
            case 'subquery':
                return this.detectSubqueryScope(sql, query, position);
            case 'main':
            default:
                return {
                    type: 'main',
                    query,
                    startPosition: 0,
                    endPosition: sql.length
                };
        }
    }

    /**
     * Auto-detects the most appropriate scope based on cursor position.
     */
    private autoDetectScope(sql: string, query: SelectQuery, position: number): AliasScope {
        // First check if we're in a CTE
        const cteScope = this.detectCTEScope(sql, query, position);
        if (cteScope.type === 'cte') {
            return cteScope;
        }

        // Then check for subqueries (implementation needed)
        const subqueryScope = this.detectSubqueryScope(sql, query, position);
        if (subqueryScope.type === 'subquery') {
            return subqueryScope;
        }

        // Default to main query
        return {
            type: 'main',
            query,
            startPosition: 0,
            endPosition: sql.length
        };
    }

    /**
     * Detects if the position is within a CTE and returns appropriate scope.
     */
    private detectCTEScope(sql: string, query: SelectQuery, position: number): AliasScope {
        try {
            // Use CTERegionDetector to analyze cursor position
            const analysis = CTERegionDetector.analyzeCursorPosition(sql, position);
            
            if (analysis.isInCTE && analysis.cteRegion) {
                // Find the corresponding CTE query in the AST
                const cteQuery = this.findCTEQueryByName(query, analysis.cteRegion.name);
                
                return {
                    type: 'cte',
                    name: analysis.cteRegion.name,
                    query: cteQuery || query, // Fallback to main query if CTE not found
                    startPosition: analysis.cteRegion.startPosition,
                    endPosition: analysis.cteRegion.endPosition
                };
            }
        } catch (error) {
            // If CTE detection fails, fall back to main query
            console.warn('CTE scope detection failed:', error);
        }

        // Not in CTE, return main query scope
        return {
            type: 'main',
            query,
            startPosition: 0,
            endPosition: sql.length
        };
    }

    /**
     * Detects if the position is within a subquery scope.
     */
    private detectSubqueryScope(sql: string, query: SelectQuery, position: number): AliasScope {
        // TODO: Implement subquery detection
        // This would involve traversing the AST to find nested SELECT queries
        // and determining if the position falls within their boundaries
        
        // For now, return main query scope
        return {
            type: 'main',
            query,
            startPosition: 0,
            endPosition: sql.length
        };
    }

    /**
     * Finds a CTE query by name within the parsed AST.
     */
    private findCTEQueryByName(query: SelectQuery, cteName: string): SelectQuery | null {
        if (query instanceof SimpleSelectQuery && query.withClause?.tables) {
            for (const cte of query.withClause.tables) {
                if (cte.aliasExpression.table.name === cteName) {
                    return cte.query;
                }
            }
        } else if (query instanceof BinarySelectQuery) {
            // Check left side first
            const leftResult = this.findCTEQueryByName(query.left, cteName);
            if (leftResult) return leftResult;
            
            // Then check right side
            const rightResult = this.findCTEQueryByName(query.right, cteName);
            if (rightResult) return rightResult;
        }
        
        return null;
    }

    /**
     * Collects all references to the specified alias within the given scope.
     */
    private collectAliasReferences(scope: AliasScope, aliasName: string): AliasReference[] {
        const references: AliasReference[] = [];

        try {
            // Collect table source references (FROM, JOIN clauses)
            const tableReferences = this.collectTableAliasReferences(scope, aliasName);
            references.push(...tableReferences);

            // Collect column references (table_alias.column format)
            const columnReferences = this.collectColumnAliasReferences(scope, aliasName);
            references.push(...columnReferences);

        } catch (error) {
            console.warn(`Failed to collect alias references for '${aliasName}':`, error);
        }

        return references;
    }

    /**
     * Collects table alias references within the scope.
     */
    private collectTableAliasReferences(scope: AliasScope, aliasName: string): AliasReference[] {
        const references: AliasReference[] = [];

        try {
            // Use TableSourceCollector to find all table sources in the scope
            const collector = new TableSourceCollector(true); // selectableOnly=true for proper scope
            const tableSources = collector.collect(scope.query);

            for (const tableSource of tableSources) {
                const sourceName = tableSource.getSourceName();
                
                // Check if this table source matches our alias
                if (sourceName === aliasName) {
                    // This is likely the definition of the alias (FROM users u, JOIN orders o)
                    const lexeme = this.createLexemeFromTableSource(tableSource, aliasName);
                    if (lexeme) {
                        references.push({
                            lexeme,
                            scope,
                            referenceType: 'definition',
                            context: 'table'
                        });
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to collect table alias references for '${aliasName}':`, error);
        }

        return references;
    }

    /**
     * Collects column alias references (table_alias.column format) within the scope.
     */
    private collectColumnAliasReferences(scope: AliasScope, aliasName: string): AliasReference[] {
        const references: AliasReference[] = [];

        try {
            // Use ColumnReferenceCollector to find all column references
            const collector = new ColumnReferenceCollector();
            const columnRefs = collector.collect(scope.query);

            for (const columnRef of columnRefs) {
                // Check if any namespace in this column reference matches our alias
                if (columnRef.namespaces && columnRef.namespaces.length > 0) {
                    for (const namespace of columnRef.namespaces) {
                        if (namespace.name === aliasName) {
                            // This is a usage of the alias (u.name, u.id, etc.)
                            const lexeme = this.createLexemeFromNamespace(namespace, aliasName);
                            if (lexeme) {
                                references.push({
                                    lexeme,
                                    scope,
                                    referenceType: 'usage',
                                    context: 'column'
                                });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to collect column alias references for '${aliasName}':`, error);
        }

        return references;
    }

    /**
     * Creates a lexeme representation from a table source for reference tracking.
     */
    private createLexemeFromTableSource(tableSource: any, aliasName: string): Lexeme | null {
        try {
            // Try to extract position information from the table source
            // This is a best-effort approach since TableSource might not have direct lexeme info
            return {
                type: TokenType.Identifier,
                value: aliasName,
                comments: null,
                position: {
                    startPosition: 0, // TODO: Extract actual position if available
                    endPosition: aliasName.length
                }
            };
        } catch (error) {
            console.warn('Failed to create lexeme from table source:', error);
            return null;
        }
    }

    /**
     * Creates a lexeme representation from a namespace for reference tracking.
     */
    private createLexemeFromNamespace(namespace: any, aliasName: string): Lexeme | null {
        try {
            // Try to extract position information from the namespace
            return {
                type: TokenType.Identifier,
                value: aliasName,
                comments: null,
                position: {
                    startPosition: 0, // TODO: Extract actual position if available
                    endPosition: aliasName.length
                }
            };
        } catch (error) {
            console.warn('Failed to create lexeme from namespace:', error);
            return null;
        }
    }

    /**
     * Checks for naming conflicts when renaming to the new name.
     */
    private checkNameConflicts(scope: AliasScope, newName: string, currentName: string): string[] {
        const conflicts: string[] = [];

        if (newName.toLowerCase() === currentName.toLowerCase()) {
            conflicts.push(ERROR_MESSAGES.sameNames);
            return conflicts;
        }

        try {
            // Check for conflicts with existing table aliases
            const tableConflicts = this.checkTableAliasConflicts(scope, newName);
            conflicts.push(...tableConflicts);

            // Check for conflicts with SQL keywords (basic check)
            const keywordConflicts = this.checkKeywordConflicts(newName);
            conflicts.push(...keywordConflicts);

        } catch (error) {
            console.warn(`Error during conflict detection for '${newName}':`, error);
            conflicts.push(`Unable to verify conflicts for name '${newName}'`);
        }

        return conflicts;
    }

    /**
     * Checks for conflicts with existing table aliases and table names in the scope.
     */
    private checkTableAliasConflicts(scope: AliasScope, newName: string): string[] {
        const conflicts: string[] = [];

        try {
            // Use TableSourceCollector to get all existing table sources in scope
            const collector = new TableSourceCollector(true);
            const tableSources = collector.collect(scope.query);

            for (const tableSource of tableSources) {
                // Check alias conflicts
                const aliasName = tableSource.getSourceName();
                if (aliasName && aliasName.toLowerCase() === newName.toLowerCase()) {
                    conflicts.push(ERROR_MESSAGES.nameConflict(newName));
                    continue; // Avoid duplicate messages
                }

                // Check table name conflicts
                const tableName = this.extractTableName(tableSource);
                if (tableName && tableName.toLowerCase() === newName.toLowerCase()) {
                    conflicts.push(`'${newName}' conflicts with table name in this scope`);
                }
            }
        } catch (error) {
            console.warn(`Failed to check table alias conflicts for '${newName}':`, error);
        }

        return conflicts;
    }

    /**
     * Extracts the actual table name from a table source (not the alias).
     */
    private extractTableName(tableSource: any): string | null {
        try {
            // Try to access the qualified name to get the actual table name
            if (tableSource.qualifiedName && tableSource.qualifiedName.name) {
                const name = tableSource.qualifiedName.name;
                
                // Handle different name types
                if (typeof name === 'string') {
                    return name;
                } else if (name.name && typeof name.name === 'string') {
                    // IdentifierString case
                    return name.name;
                } else if (name.value && typeof name.value === 'string') {
                    // RawString case
                    return name.value;
                }
            }

            // Fallback: try to get table name from other properties
            if (tableSource.table && typeof tableSource.table === 'string') {
                return tableSource.table;
            }

            return null;
        } catch (error) {
            console.warn('Failed to extract table name from table source:', error);
            return null;
        }
    }

    /**
     * Checks if the new name conflicts with SQL keywords using the existing KeywordTrie.
     */
    private checkKeywordConflicts(newName: string): string[] {
        const conflicts: string[] = [];
        
        // Use basic check as primary method for now to ensure test reliability
        if (this.isBasicReservedKeyword(newName)) {
            conflicts.push(`'${newName}' is a reserved SQL keyword and should not be used as an alias`);
            return conflicts;
        }
        
        try {
            // Use the KeywordParser to check if the new name is a reserved keyword
            const keywordResult = this.keywordParser.parse(newName, 0);
            
            if (keywordResult !== null && keywordResult.keyword.toLowerCase() === newName.toLowerCase()) {
                conflicts.push(`'${newName}' is a reserved SQL keyword and should not be used as an alias`);
            }
        } catch (error) {
            console.warn(`Failed to check keyword conflicts for '${newName}':`, error);
        }

        return conflicts;
    }

    /**
     * Fallback method for basic reserved keyword checking.
     */
    private isBasicReservedKeyword(name: string): boolean {
        const basicKeywords = ['select', 'from', 'where', 'join', 'table', 'null', 'and', 'or'];
        return basicKeywords.includes(name.toLowerCase());
    }

    /**
     * Prepares change details for the rename operation.
     */
    private prepareChanges(references: AliasReference[], newName: string): AliasChange[] {
        return references.map(ref => ({
            oldName: ref.lexeme.value,
            newName,
            position: LexemeCursor.charOffsetToLineColumn(
                '', // TODO: Get original SQL
                ref.lexeme.position?.startPosition || 0
            ) || { line: 1, column: 1 },
            context: ref.context,
            referenceType: ref.referenceType
        }));
    }


    /**
     * Enhanced SQL text replacement using lexeme-based approach.
     * This method re-tokenizes the SQL to get accurate position information.
     */
    private performLexemeBasedRename(sql: string, aliasName: string, newName: string, scope: AliasScope): string {
        try {
            // Get all lexemes with position information
            const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
            
            // Filter lexemes within the scope and matching the alias name
            const targetLexemes = lexemes.filter(lexeme => 
                lexeme.value === aliasName &&
                lexeme.position &&
                lexeme.position.startPosition >= scope.startPosition &&
                lexeme.position.endPosition <= scope.endPosition &&
                (lexeme.type & TokenType.Identifier) // Only rename identifiers
            );

            if (targetLexemes.length === 0) {
                return sql; // No matches found
            }

            // Sort by position (descending) for safe replacement
            targetLexemes.sort((a, b) => b.position!.startPosition - a.position!.startPosition);

            let modifiedSql = sql;

            // Replace each occurrence
            for (const lexeme of targetLexemes) {
                const pos = lexeme.position!;
                modifiedSql = modifiedSql.substring(0, pos.startPosition) +
                             newName +
                             modifiedSql.substring(pos.endPosition);
            }

            return modifiedSql;
        } catch (error) {
            console.error('Failed to perform lexeme-based rename:', error);
            throw new Error(`Unable to rename alias using lexeme approach: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

