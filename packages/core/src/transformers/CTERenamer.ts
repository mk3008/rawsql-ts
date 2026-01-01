import { SimpleSelectQuery } from "../models/SimpleSelectQuery";
import { BinarySelectQuery } from "../models/BinarySelectQuery";
import { SelectQuery } from "../models/SelectQuery";
import { CTEDependencyAnalyzer } from "./CTEDependencyAnalyzer";
import { TableSourceCollector } from "./TableSourceCollector";
import { ColumnReferenceCollector } from "./ColumnReferenceCollector";
import { ColumnReference } from "../models/ValueComponent";
import { LexemeCursor, LineColumn } from "../utils/LexemeCursor";
import { SelectQueryParser } from "../parsers/SelectQueryParser";
import { TokenType } from "../models/Lexeme";
import { SqlFormatter } from "./SqlFormatter";
import { KeywordParser } from "../parsers/KeywordParser";
import { commandKeywordTrie } from "../tokenReaders/CommandTokenReader";

/**
 * Error messages for CTE renaming operations.
 */
const ERROR_MESSAGES = {
    nullQuery: 'Query cannot be null or undefined',
    invalidOldName: 'Old CTE name must be a non-empty string',
    invalidNewName: 'New CTE name must be a non-empty string',
    sameNames: 'Old and new CTE names cannot be the same',
    unsupportedQuery: 'Unsupported query type for CTE renaming',
    cteNotExists: (name: string) => `CTE '${name}' does not exist`,
    cteAlreadyExists: (name: string) => `CTE '${name}' already exists`,
    cteNotFound: (name: string) => `CTE '${name}' not found`,
} as const;

/**
 * A utility class for renaming Common Table Expressions (CTEs) in SQL queries.
 * 
 * This class provides functionality to safely rename CTEs while automatically updating
 * all column references and table references throughout the query, including within
 * nested CTE definitions and subqueries.
 * 
 * @example
 * ```typescript
 * import { CTERenamer, SelectQueryParser } from 'rawsql-ts';
 * 
 * const sql = `
 *   WITH user_data AS (
 *     SELECT id, name FROM users
 *   ),
 *   order_summary AS (
 *     SELECT user_data.id, COUNT(*) as order_count
 *     FROM user_data
 *     JOIN orders ON user_data.id = orders.user_id
 *     GROUP BY user_data.id
 *   )
 *   SELECT * FROM order_summary
 * `;
 * 
 * const query = SelectQueryParser.parse(sql);
 * const renamer = new CTERenamer();
 * 
 * // Rename 'user_data' to 'customer_data'
 * renamer.renameCTE(query, 'user_data', 'customer_data');
 * 
 * // All references are automatically updated:
 * // - CTE definition: WITH customer_data AS (...)
 * // - Column references: customer_data.id
 * // - Table references: FROM customer_data
 * ```
 * 
 * @example
 * ```typescript
 * // Error handling
 * try {
 *   renamer.renameCTE(query, 'nonexistent_cte', 'new_name');
 * } catch (error) {
 *   console.error(error.message); // "CTE 'nonexistent_cte' does not exist"
 * }
 * 
 * try {
 *   renamer.renameCTE(query, 'existing_cte', 'already_exists');
 * } catch (error) {
 *   console.error(error.message); // "CTE 'already_exists' already exists"
 * }
 * ```
 * 
 * Related tests: packages/core/tests/transformers/CTERenamer.test.ts
 * @since 0.11.16
 */
export class CTERenamer {
    // Use shared keyword trie from CommandTokenReader to avoid duplication

    private dependencyAnalyzer: CTEDependencyAnalyzer;
    private columnReferenceCollector: ColumnReferenceCollector;
    private tableSourceCollector: TableSourceCollector;
    private keywordParser: KeywordParser;

    /**
     * Creates a new instance of CTERenamer.
     * 
     * The constructor initializes internal collectors and analyzers needed for
     * comprehensive CTE renaming operations.
     */
    constructor() {
        this.dependencyAnalyzer = new CTEDependencyAnalyzer();
        this.columnReferenceCollector = new ColumnReferenceCollector();
        this.tableSourceCollector = new TableSourceCollector(); // Use default selectableOnly=true to avoid infinite recursion
        this.keywordParser = new KeywordParser(commandKeywordTrie);
    }

    /**
     * Renames a Common Table Expression (CTE) and updates all references to it.
     * 
     * This method performs a comprehensive rename operation that includes:
     * - Updating the CTE definition name in the WITH clause
     * - Updating all column references (e.g., `old_name.column` -> `new_name.column`)
     * - Updating all table references in FROM and JOIN clauses
     * - Processing references within nested CTEs and subqueries
     * 
     * @param query - The SQL query containing the CTE to rename. Can be either SimpleSelectQuery or BinarySelectQuery (UNION/INTERSECT/EXCEPT).
     * @param oldName - The current name of the CTE to rename.
     * @param newName - The new name for the CTE.
     * 
     * @throws {Error} When the specified CTE does not exist in the query.
     * @throws {Error} When a CTE with the new name already exists.
     * @throws {Error} When the query type is not supported (not a SelectQuery).
     * 
     * @example
     * ```typescript
     * const renamer = new CTERenamer();
     * 
     * // Basic usage
     * renamer.renameCTE(query, 'old_cte_name', 'new_cte_name');
     * 
     * // With error handling
     * try {
     *   renamer.renameCTE(query, 'user_data', 'customer_data');
     * } catch (error) {
     *   if (error.message.includes('does not exist')) {
     *     console.log('CTE not found');
     *   } else if (error.message.includes('already exists')) {
     *     console.log('Name conflict');
     *   }
     * }
     * ```
     * 
     * Related tests: packages/core/tests/transformers/CTERenamer.test.ts
 * @since 0.11.16
     */
    public renameCTE(query: SelectQuery, oldName: string, newName: string): void {
        // Input validation
        this.validateInputs(query, oldName, newName);

        // Sanitize input names
        const sanitizedOldName = oldName.trim();
        const sanitizedNewName = newName.trim();

        if (query instanceof SimpleSelectQuery) {
            this.renameInSimpleQuery(query, sanitizedOldName, sanitizedNewName);
        } else if (query instanceof BinarySelectQuery) {
            this.renameInBinaryQuery(query, sanitizedOldName, sanitizedNewName);
        } else {
            throw new Error(ERROR_MESSAGES.unsupportedQuery);
        }
    }

    /**
     * Validates input parameters for CTE renaming.
     */
    private validateInputs(query: SelectQuery, oldName: string, newName: string): void {
        if (!query) {
            throw new Error(ERROR_MESSAGES.nullQuery);
        }
        if (!oldName || typeof oldName !== 'string' || oldName.trim() === '') {
            throw new Error(ERROR_MESSAGES.invalidOldName);
        }
        if (!newName || typeof newName !== 'string' || newName.trim() === '') {
            throw new Error(ERROR_MESSAGES.invalidNewName);
        }
        if (oldName.trim() === newName.trim()) {
            throw new Error(ERROR_MESSAGES.sameNames);
        }
    }

    /**
     * Handles CTE renaming for SimpleSelectQuery.
     */
    private renameInSimpleQuery(query: SimpleSelectQuery, oldName: string, newName: string): void {
        // Get available CTE names
        const availableCTEs = query.getCTENames();
        
        // Check if CTE exists
        if (!availableCTEs.includes(oldName)) {
            throw new Error(ERROR_MESSAGES.cteNotExists(oldName));
        }

        // Check for name conflicts
        if (availableCTEs.includes(newName)) {
            throw new Error(ERROR_MESSAGES.cteAlreadyExists(newName));
        }

        // Rename CTE definition
        this.renameCTEDefinition(query, oldName, newName);

        // Update all references
        this.updateAllReferences(query, oldName, newName);
    }

    /**
     * Handles CTE renaming for BinarySelectQuery.
     */
    private renameInBinaryQuery(query: BinarySelectQuery, oldName: string, newName: string): void {
        // Use toSimpleQuery() only for WITH clause inspection (not for writing back)
        const withClauseQuery = query.toSimpleQuery();
        
        // Get available CTE names from the converted query
        let availableCTEs: string[] = [];
        if (withClauseQuery.withClause && withClauseQuery.withClause.tables) {
            availableCTEs = withClauseQuery.withClause.tables.map(cte => cte.aliasExpression.table.name);
        }
        
        // Check if CTE exists
        if (!availableCTEs.includes(oldName)) {
            throw new Error(ERROR_MESSAGES.cteNotExists(oldName));
        }

        // Check for name conflicts
        if (availableCTEs.includes(newName)) {
            throw new Error(ERROR_MESSAGES.cteAlreadyExists(newName));
        }

        // Rename CTE definition in the converted query (this affects the original BinarySelectQuery)
        this.renameCTEDefinition(withClauseQuery, oldName, newName);
        
        // Add withClause to original BinarySelectQuery and left query for proper formatting
        if (withClauseQuery.withClause) {
            (query as any).withClause = withClauseQuery.withClause;
            
            // Also add to left query so formatter can display it
            if (query.left instanceof SimpleSelectQuery) {
                query.left.withClause = withClauseQuery.withClause;
            }
        }

        // Recursively update references in left and right branches
        this.renameInSelectQuery(query.left, oldName, newName);
        this.renameInSelectQuery(query.right, oldName, newName);
    }

    /**
     * Recursively handles CTE renaming for any SelectQuery type.
     */
    private renameInSelectQuery(query: SelectQuery, oldName: string, newName: string): void {
        if (query instanceof SimpleSelectQuery) {
            // For SimpleSelectQuery, only update references (not CTE definitions)
            this.updateAllReferences(query, oldName, newName);
        } else if (query instanceof BinarySelectQuery) {
            // Recursively process left and right branches
            this.renameInSelectQuery(query.left, oldName, newName);
            this.renameInSelectQuery(query.right, oldName, newName);
        }
        // ValuesQuery: do nothing
    }

    /**
     * Renames the CTE definition in the WITH clause.
     */
    private renameCTEDefinition(query: SimpleSelectQuery, oldName: string, newName: string): void {
        if (!query.withClause || !query.withClause.tables) {
            throw new Error(ERROR_MESSAGES.cteNotFound(oldName));
        }

        const cteToRename = query.withClause.tables.find(cte => cte.aliasExpression.table.name === oldName);
        if (!cteToRename) {
            throw new Error(ERROR_MESSAGES.cteNotFound(oldName));
        }

        cteToRename.aliasExpression.table.name = newName;
    }

    /**
     * Updates all references to the old CTE name (column references and table sources).
     */
    private updateAllReferences(query: SimpleSelectQuery, oldName: string, newName: string): void {
        // Collect all column references from the query (including CTE internals)
        const columnReferences = this.columnReferenceCollector.collect(query);
        
        // Update all column references that reference the old CTE name
        for (const columnRef of columnReferences) {
            // Check namespaces for the old CTE name
            if (columnRef.namespaces && columnRef.namespaces.length > 0) {
                // Check if any namespace matches the old CTE name
                for (const namespace of columnRef.namespaces) {
                    if (namespace.name === oldName) {
                        namespace.name = newName;
                        break;
                    }
                }
            }
        }

        // Update table sources in the main query
        const tableSources = this.tableSourceCollector.collect(query);
        for (const tableSource of tableSources) {
            if (tableSource.getSourceName() === oldName) {
                if (tableSource.qualifiedName.name instanceof ColumnReference) {
                    // Handle ColumnReference case if needed
                } else if ('name' in tableSource.qualifiedName.name) {
                    // Handle IdentifierString
                    (tableSource.qualifiedName.name as any).name = newName;
                } else {
                    // Handle RawString
                    (tableSource.qualifiedName.name as any).value = newName;
                }
            }
        }

        // Update table sources that reference the old CTE name within CTEs
        this.updateTableSourcesInCTEs(query, oldName, newName);
    }

    /**
     * Updates table sources within CTE definitions that reference the old CTE name.
     * This method manually traverses CTE internals to avoid infinite recursion
     * that occurs when using TableSourceCollector with selectableOnly=false.
     */
    private updateTableSourcesInCTEs(query: SimpleSelectQuery, oldName: string, newName: string): void {
        if (!query.withClause || !query.withClause.tables) {
            return;
        }

        // Traverse each CTE and update table sources in their FROM clauses     
        for (const cte of query.withClause.tables) {
            // Writable CTEs don't expose FROM/JOIN sources for renaming here.
            if (cte.query instanceof SimpleSelectQuery) {
                this.updateTableSourcesInQuery(cte.query, oldName, newName);
            }
        }
    }

    /**
     * Updates table sources in a specific query (used for CTE internals).
     */
    private updateTableSourcesInQuery(query: SimpleSelectQuery, oldName: string, newName: string): void {
        // Update FROM clause
        if (query.fromClause && query.fromClause.source.datasource) {
            this.updateTableSource(query.fromClause.source.datasource, oldName, newName);
        }

        // Update JOIN clauses
        if (query.fromClause && query.fromClause.joins) {
            for (const join of query.fromClause.joins) {
                if (join.source.datasource) {
                    this.updateTableSource(join.source.datasource, oldName, newName);
                }
            }
        }
    }

    /**
     * Updates a specific table source if it matches the old CTE name.
     */
    private updateTableSource(datasource: unknown, oldName: string, newName: string): void {
        // Type guard and null checks for security
        if (!datasource || typeof datasource !== 'object') {
            return;
        }

        const source = datasource as Record<string, unknown>;
        
        // Safely check if this is a TableSource
        if (typeof source.getSourceName === 'function') {
            try {
                const sourceName = source.getSourceName();
                if (sourceName === oldName && source.qualifiedName && typeof source.qualifiedName === 'object') {
                    const qualifiedName = source.qualifiedName as Record<string, unknown>;
                    
                    if (qualifiedName.name && typeof qualifiedName.name === 'object') {
                        const nameObj = qualifiedName.name as Record<string, unknown>;
                        
                        if ('name' in nameObj && typeof nameObj.name === 'string') {
                            // Handle IdentifierString
                            nameObj.name = newName;
                        } else if ('value' in nameObj && typeof nameObj.value === 'string') {
                            // Handle RawString
                            nameObj.value = newName;
                        }
                    }
                }
            } catch (error) {
                // Safely handle any unexpected errors during table source update
                console.warn('Warning: Failed to update table source:', error);
            }
        }
    }

    /**
     * GUI-integrated CTE renaming with line/column position support.
     * 
     * Designed for editor integration where users can right-click on CTE names
     * and rename them. Automatically detects the CTE name at the cursor position
     * and performs the rename operation.
     * 
     * @param sql - The complete SQL string containing CTE definitions
     * @param position - Line and column position where the user clicked (1-based)
     * @param newName - The new name for the CTE
     * @returns The updated SQL string with the CTE renamed
     * 
     * @throws {Error} When no CTE name is found at the specified position
     * @throws {Error} When the new name conflicts with existing CTE names
     * 
     * @example
     * ```typescript
     * const sql = `
     *   WITH user_data AS (SELECT * FROM users),
     *        order_data AS (SELECT * FROM orders)
     *   SELECT * FROM user_data JOIN order_data ON ...
     * `;
     * 
     * const renamer = new CTERenamer();
     * // User right-clicks on 'user_data' at line 2, column 8
     * const result = renamer.renameCTEAtPosition(sql, { line: 2, column: 8 }, 'customer_data');
     * console.log(result);
     * // Returns SQL with 'user_data' renamed to 'customer_data' everywhere
     * ```
     */
    public renameCTEAtPosition(sql: string, position: LineColumn, newName: string): string {
        // Input validation
        if (!sql?.trim()) {
            throw new Error('SQL cannot be empty');
        }
        if (!position || position.line < 1 || position.column < 1) {
            throw new Error('Position must be a valid line/column (1-based)');
        }
        if (!newName?.trim()) {
            throw new Error('New CTE name cannot be empty');
        }

        // Find the lexeme at the specified position
        const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, position);
        if (!lexeme) {
            throw new Error(`No CTE name found at line ${position.line}, column ${position.column}`);
        }

        const cteName = lexeme.value;
        
        // Parse the SQL to get the query structure
        const query = SelectQueryParser.parse(sql);
        
        // First check if this is actually a CTE name in the query
        if (!this.isCTENameInQuery(query, cteName)) {
            throw new Error(`'${cteName}' is not a CTE name in this query`);
        }

        // Validate that the lexeme is a valid identifier or function (not a command/keyword)
        if (!(lexeme.type & (TokenType.Identifier | TokenType.Function))) {
            throw new Error(`Token at position is not a CTE name: '${lexeme.value}'`);
        }

        // Check for naming conflicts
        const conflicts = this.checkNameConflicts(query, newName, cteName);
        if (conflicts.length > 0) {
            throw new Error(conflicts.join(', '));
        }

        // Perform the CTE rename operation
        this.renameCTE(query, cteName, newName);
        
        // Return the formatted SQL using SqlFormatter
        const formatter = new SqlFormatter();
        const result = formatter.format(query);
        return result.formattedSql;
    }

    /**
     * Check for naming conflicts with existing CTEs and reserved keywords.
     * @private
     */
    private checkNameConflicts(query: SelectQuery, newName: string, currentName: string): string[] {
        const conflicts: string[] = [];

        // Skip checks if the name isn't actually changing
        if (currentName === newName) {
            return conflicts;
        }

        // Check for reserved keyword conflicts
        conflicts.push(...this.checkKeywordConflicts(newName));

        // Check for existing CTE name conflicts
        if (this.isCTENameInQuery(query, newName)) {
            conflicts.push(`CTE name '${newName}' already exists`);
        }

        return conflicts;
    }

    /**
     * Checks if the new name conflicts with SQL keywords using the existing KeywordTrie.
     * @private
     */
    private checkKeywordConflicts(newName: string): string[] {
        const conflicts: string[] = [];
        
        try {
            // Use the KeywordParser to check if the new name is a reserved keyword
            const keywordResult = this.keywordParser.parse(newName, 0);
            
            if (keywordResult !== null && keywordResult.keyword.toLowerCase() === newName.toLowerCase()) {
                conflicts.push(`'${newName}' is a reserved SQL keyword and should not be used as a CTE name`);
            }
        } catch (error) {
            console.warn(`Failed to check keyword conflicts for '${newName}':`, error);
            // Fallback to basic check if KeywordParser fails
            if (this.isBasicReservedKeyword(newName)) {
                conflicts.push(`'${newName}' is a reserved SQL keyword and should not be used as a CTE name`);
            }
        }

        return conflicts;
    }

    /**
     * Fallback method for basic reserved keyword checking.
     * @private
     */
    private isBasicReservedKeyword(name: string): boolean {
        const basicKeywords = ['select', 'from', 'where', 'with', 'as', 'union', 'join', 'table', 'null'];
        return basicKeywords.includes(name.toLowerCase());
    }

    /**
     * Check if a CTE name exists in the query.
     * @private
     */
    private isCTENameInQuery(query: SelectQuery, cteName: string): boolean {
        if (query instanceof SimpleSelectQuery && query.withClause) {
            return query.withClause.tables.some(cte => 
                cte.aliasExpression && cte.aliasExpression.table && cte.aliasExpression.table.name === cteName
            );
        }
        if (query instanceof BinarySelectQuery) {
            return this.isCTENameInQuery(query.left, cteName) || 
                   this.isCTENameInQuery(query.right, cteName);
        }
        return false;
    }
}



