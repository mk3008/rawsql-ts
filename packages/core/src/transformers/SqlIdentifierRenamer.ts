/**
 * Represents a position in the SQL text
 */
export interface Position {
    line: number;   // 1-based line number
    column: number; // 1-based column number
}

/**
 * Represents a scope range for identifier renaming
 */
export interface ScopeRange {
    start: number;  // Start position in SQL string
    end: number;    // End position in SQL string
}

/**
 * Result of renameability check
 */
export interface Renameability {
    canRename: boolean;
    currentName?: string;
    type?: 'cte' | 'table_alias' | 'column_alias';
    scopeRange?: ScopeRange;
    reason?: string; // Why renaming is not possible
}

/**
 * Handles safe renaming of SQL identifiers within plain SQL strings.
 *
 * @example
 * ```typescript
 * const renamer = new SqlIdentifierRenamer();
 * const sql = 'SELECT u.id FROM users u';
 * const result = renamer.renameIdentifier(sql, 'u', 'users_alias');
 * ```
 * Related tests: packages/core/tests/transformers/SqlIdentifierRenamer.test.ts
 */
export class SqlIdentifierRenamer {
    
    /**
     * Safely renames identifiers in SQL string while preserving context
     * @param sql SQL string to modify
     * @param renames Map of original identifiers to new identifiers
     * @returns Modified SQL string with renamed identifiers
     */
    public renameIdentifiers(sql: string, renames: Map<string, string>): string {
        if (renames.size === 0) {
            return sql;
        }

        let result = sql;

        // Apply all renames
        for (const [originalValue, newValue] of renames) {
            result = this.replaceIdentifierSafely(result, originalValue, newValue);
        }

        return result;
    }

    /**
     * Renames a single identifier in SQL string
     * @param sql SQL string to modify
     * @param oldIdentifier Original identifier to replace
     * @param newIdentifier New identifier to replace with
     * @returns Modified SQL string
     */
    public renameIdentifier(sql: string, oldIdentifier: string, newIdentifier: string): string {
        return this.replaceIdentifierSafely(sql, oldIdentifier, newIdentifier);
    }

    /**
     * Renames a single identifier within a specified scope range
     * @param sql SQL string to modify
     * @param oldIdentifier Original identifier to replace
     * @param newIdentifier New identifier to replace with
     * @param scopeRange Optional scope range to limit replacement
     * @returns Modified SQL string
     */
    public renameIdentifierInScope(sql: string, oldIdentifier: string, newIdentifier: string, scopeRange?: ScopeRange): string {
        if (!scopeRange) {
            // Fallback to full SQL replacement
            return this.replaceIdentifierSafely(sql, oldIdentifier, newIdentifier);
        }
        
        // Extract the portion of SQL within scope range
        const beforeScope = sql.slice(0, scopeRange.start);
        const scopeContent = sql.slice(scopeRange.start, scopeRange.end);
        const afterScope = sql.slice(scopeRange.end);
        
        // Replace identifiers only within the scope
        const modifiedScopeContent = this.replaceIdentifierSafely(scopeContent, oldIdentifier, newIdentifier);
        
        // Reconstruct the full SQL
        return beforeScope + modifiedScopeContent + afterScope;
    }

    /**
     * Checks if an identifier at the given position can be renamed
     * @param sql SQL string
     * @param position Position in the SQL text
     * @returns Renameability result
     */
    public checkRenameability(sql: string, position: Position): Renameability {
        // Convert line/column to character position
        const charPosition = this.positionToCharIndex(sql, position);
        
        // TODO: Implement proper identifier detection and scope analysis
        // For now, minimal implementation to make tests pass
        
        // Simple detection - if we're in a string literal, not renameable
        if (this.isInsideStringLiteral(sql, charPosition)) {
            return {
                canRename: false,
                reason: 'Cannot rename identifiers inside string literal'
            };
        }
        
        // Detect if we're on an identifier (simplified)
        const identifier = this.getIdentifierAtPosition(sql, charPosition);
        if (!identifier) {
            return {
                canRename: false,
                reason: 'No identifier found at position'
            };
        }
        
        // Determine type and scope (simplified logic)
        const type = this.determineIdentifierType(sql, charPosition, identifier);
        const scopeRange = this.calculateScopeRange(sql, charPosition, type);
        
        return {
            canRename: true,
            currentName: identifier,
            type: type,
            scopeRange: scopeRange
        };
    }

    /**
     * Renames identifier at the specified position
     * @param sql SQL string
     * @param position Position in the SQL text
     * @param newName New identifier name
     * @returns Modified SQL string
     */
    public renameAtPosition(sql: string, position: Position, newName: string): string {
        const renameability = this.checkRenameability(sql, position);
        
        if (!renameability.canRename || !renameability.currentName) {
            throw new Error(renameability.reason || 'Cannot rename at this position');
        }
        
        return this.renameIdentifierInScope(
            sql, 
            renameability.currentName, 
            newName, 
            renameability.scopeRange
        );
    }

    /**
     * Convert line/column position to character index
     */
    private positionToCharIndex(sql: string, position: Position): number {
        const lines = sql.split('\n');
        let charIndex = 0;
        
        for (let i = 0; i < position.line - 1 && i < lines.length; i++) {
            charIndex += lines[i].length + 1; // +1 for newline
        }
        
        charIndex += position.column - 1;
        return Math.min(charIndex, sql.length - 1);
    }

    /**
     * Check if position is inside a string literal
     */
    private isInsideStringLiteral(sql: string, charPosition: number): boolean {
        // Simple check - count single quotes before position
        let inString = false;
        for (let i = 0; i < charPosition && i < sql.length; i++) {
            if (sql[i] === "'") {
                inString = !inString;
            }
        }
        return inString;
    }

    /**
     * Get identifier at the specified character position
     */
    private getIdentifierAtPosition(sql: string, charPosition: number): string | null {
        if (charPosition >= sql.length) return null;
        
        // Find start of identifier
        let start = charPosition;
        while (start > 0 && this.isIdentifierChar(sql.charCodeAt(start - 1))) {
            start--;
        }
        
        // Find end of identifier
        let end = charPosition;
        while (end < sql.length && this.isIdentifierChar(sql.charCodeAt(end))) {
            end++;
        }
        
        if (start === end) return null;
        return sql.slice(start, end);
    }

    /**
     * Determine the type of identifier (improved logic)
     */
    private determineIdentifierType(sql: string, charPosition: number, identifier: string): 'cte' | 'table_alias' | 'column_alias' {
        const beforePosition = sql.slice(0, charPosition);
        const afterPosition = sql.slice(charPosition);
        
        // Check if this is a CTE name (appears between WITH and AS)
        const beforeUpper = beforePosition.toUpperCase();
        const afterUpper = afterPosition.toUpperCase();
        
        // Find last WITH before our position
        const lastWithIndex = beforeUpper.lastIndexOf('WITH');
        if (lastWithIndex !== -1) {
            // Get the identifier bounds
            let start = charPosition;
            while (start > 0 && this.isIdentifierChar(sql.charCodeAt(start - 1))) {
                start--;
            }
            let end = charPosition;
            while (end < sql.length && this.isIdentifierChar(sql.charCodeAt(end))) {
                end++;
            }
            
            // Check what comes after the complete identifier
            const afterIdentifier = sql.slice(end).toUpperCase();
            
            // CTE pattern: WITH identifier AS (
            if (afterIdentifier.trim().startsWith('AS (')) {
                return 'cte';
            }
        }
        
        // Check if this appears after FROM or JOIN (table alias)
        const beforeLines = beforePosition.split('\n');
        const currentLine = beforeLines[beforeLines.length - 1].toUpperCase();
        
        if (currentLine.includes('FROM ') || currentLine.includes('JOIN ')) {
            return 'table_alias';
        }
        
        // Check context around the identifier for table alias patterns
        const contextBefore = beforePosition.slice(Math.max(0, charPosition - 50));
        const contextAfter = afterPosition.slice(0, 50);
        const fullContext = (contextBefore + identifier + contextAfter).toUpperCase();
        
        // Table alias patterns: "FROM table AS alias" or "JOIN table alias"
        if (fullContext.includes(' AS ' + identifier.toUpperCase()) || 
            fullContext.includes(' ' + identifier.toUpperCase() + ' ON') ||
            fullContext.includes(' ' + identifier.toUpperCase() + '\n')) {
            return 'table_alias';
        }
        
        // Default to table alias if uncertain
        return 'table_alias';
    }

    /**
     * Calculate scope range for the identifier
     */
    private calculateScopeRange(sql: string, charPosition: number, type: 'cte' | 'table_alias' | 'column_alias'): ScopeRange {
        if (type === 'cte') {
            // CTE has global scope
            return { start: 0, end: sql.length };
        }
        
        // Table alias - find the containing SELECT statement (simplified)
        // This is a very basic implementation
        const beforePosition = sql.slice(0, charPosition);
        const afterPosition = sql.slice(charPosition);
        
        // Find the start of current SELECT
        const lastSelect = beforePosition.toUpperCase().lastIndexOf('SELECT');
        const start = lastSelect !== -1 ? lastSelect : 0;
        
        // Find the end (next major clause or end of SQL)
        const nextMajorClause = afterPosition.search(/\b(SELECT|WITH|UNION)\b/i);
        const end = nextMajorClause !== -1 ? charPosition + nextMajorClause : sql.length;
        
        return { start, end };
    }

    /**
     * Safely replaces SQL identifiers while preserving word boundaries and context
     * Uses character-by-character parsing instead of regex for better maintainability
     * @param sql SQL string to modify
     * @param oldIdentifier Original identifier to replace
     * @param newIdentifier New identifier to replace with
     * @returns Modified SQL string
     */
    private replaceIdentifierSafely(sql: string, oldIdentifier: string, newIdentifier: string): string {
        if (oldIdentifier === newIdentifier || oldIdentifier.length === 0) {
            return sql;
        }

        const result: string[] = [];
        let position = 0;
        const sqlLength = sql.length;
        const oldIdLength = oldIdentifier.length;
        
        while (position < sqlLength) {
            const char = sql[position];
            const charCode = char.charCodeAt(0);
            
            // Handle quoted identifiers - check for identifier matches within quotes
            if (charCode === 34 || charCode === 96 || charCode === 91) { // " ` [
                const { content, nextPosition } = this.extractAndReplaceQuotedIdentifier(sql, position, char, oldIdentifier, newIdentifier);
                result.push(content);
                position = nextPosition;
                continue;
            }
            
            // Skip string literals (only single quotes are actual string literals)
            if (charCode === 39) { // '
                const { content, nextPosition } = this.extractQuotedString(sql, position, char);
                result.push(content);
                position = nextPosition;
                continue;
            }
            
            // Skip line comments --
            if (charCode === 45 && position + 1 < sqlLength && sql.charCodeAt(position + 1) === 45) {
                const { content, nextPosition } = this.extractLineComment(sql, position);
                result.push(content);
                position = nextPosition;
                continue;
            }
            
            // Skip block comments
            if (charCode === 47 && position + 1 < sqlLength && sql.charCodeAt(position + 1) === 42) {
                const { content, nextPosition } = this.extractBlockComment(sql, position);
                result.push(content);
                position = nextPosition;
                continue;
            }
            
            // Check for potential identifier match
            if (this.isIdentifierStartChar(charCode) && this.matchesIdentifierAt(sql, position, oldIdentifier)) {
                const beforePosition = position - 1;
                const afterPosition = position + oldIdLength;
                
                // Validate word boundaries
                const beforeChar = beforePosition >= 0 ? sql[beforePosition] : null;
                const afterChar = afterPosition < sqlLength ? sql[afterPosition] : null;
                
                if (this.hasValidWordBoundaries(beforeChar, afterChar)) {
                    result.push(newIdentifier);
                    position += oldIdLength;
                    continue;
                }
            }
            
            // Default: add current character
            result.push(char);
            position++;
        }
        
        return result.join('');
    }

    /**
     * Validates that the rename operation was successful
     * @param originalSql Original SQL string
     * @param modifiedSql Modified SQL string after rename
     * @param oldIdentifier Old identifier that was replaced
     * @param newIdentifier New identifier that was added
     * @returns True if rename appears successful
     */
    public validateRename(originalSql: string, modifiedSql: string, oldIdentifier: string, newIdentifier: string): boolean {
        // Basic validation: modified SQL should be different from original
        if (originalSql === modifiedSql) {
            return false;
        }

        // The new identifier should appear in the result
        if (!modifiedSql.includes(newIdentifier)) {
            return false;
        }

        // The modified SQL should have fewer occurrences of the old identifier than the original
        const originalOccurrences = this.countWordOccurrences(originalSql, oldIdentifier);
        const modifiedOccurrences = this.countWordOccurrences(modifiedSql, oldIdentifier);
        
        return modifiedOccurrences < originalOccurrences;
    }

    /**
     * Extract and potentially replace quoted identifiers
     */
    private extractAndReplaceQuotedIdentifier(sql: string, startPosition: number, quoteChar: string, oldIdentifier: string, newIdentifier: string): { content: string; nextPosition: number } {
        if (quoteChar === '[') {
            return this.extractAndReplaceBracketedIdentifier(sql, startPosition, oldIdentifier, newIdentifier);
        }
        
        const result: string[] = [quoteChar];
        let position = startPosition + 1;
        const identifierStart = position;
        
        while (position < sql.length) {
            const char = sql[position];
            
            if (char === quoteChar) {
                // Check for escaped quotes (double quotes)
                if (position + 1 < sql.length && sql[position + 1] === quoteChar) {
                    result.push(char);
                    result.push(sql[position + 1]);
                    position += 2;
                    continue;
                }
                
                // Extract the content within quotes and check for identifier match
                const quotedContent = sql.slice(identifierStart, position);
                if (quotedContent.toLowerCase() === oldIdentifier.toLowerCase()) {
                    result.push(newIdentifier);
                } else {
                    result.push(quotedContent);
                }
                
                result.push(char); // closing quote
                break;
            }
            position++;
        }
        
        return { content: result.join(''), nextPosition: position + 1 };
    }
    
    /**
     * Extract and potentially replace bracketed identifiers [identifier]
     */
    private extractAndReplaceBracketedIdentifier(sql: string, startPosition: number, oldIdentifier: string, newIdentifier: string): { content: string; nextPosition: number } {
        const result: string[] = ['['];
        let position = startPosition + 1;
        const identifierStart = position;
        
        while (position < sql.length) {
            const char = sql[position];
            
            if (char === ']') {
                // Extract the content within brackets and check for identifier match
                const bracketedContent = sql.slice(identifierStart, position);
                if (bracketedContent.toLowerCase() === oldIdentifier.toLowerCase()) {
                    result.push(newIdentifier);
                } else {
                    result.push(bracketedContent);
                }
                
                result.push(char); // closing bracket
                break;
            }
            position++;
        }
        
        return { content: result.join(''), nextPosition: position + 1 };
    }

    /**
     * Extract quoted string (handles quotes)
     */
    private extractQuotedString(sql: string, startPosition: number, quoteChar: string): { content: string; nextPosition: number } {
        const result: string[] = [quoteChar];
        let position = startPosition + 1;
        
        while (position < sql.length) {
            const char = sql[position];
            result.push(char);
            
            if (char === quoteChar) {
                // Check for escaped quotes (double quotes)
                if (position + 1 < sql.length && sql[position + 1] === quoteChar) {
                    result.push(sql[position + 1]);
                    position += 2;
                    continue;
                }
                break;
            }
            position++;
        }
        
        return { content: result.join(''), nextPosition: position + 1 };
    }
    
    
    /**
     * Extract line comment
     */
    private extractLineComment(sql: string, startPosition: number): { content: string; nextPosition: number } {
        const result: string[] = [];
        let position = startPosition;
        
        while (position < sql.length && sql.charCodeAt(position) !== 10 && sql.charCodeAt(position) !== 13) {
            result.push(sql[position]);
            position++;
        }
        
        // Include the newline if present
        if (position < sql.length && (sql.charCodeAt(position) === 10 || sql.charCodeAt(position) === 13)) {
            result.push(sql[position]);
            position++;
        }
        
        return { content: result.join(''), nextPosition: position };
    }
    
    /**
     * Extract block comment
     */
    private extractBlockComment(sql: string, startPosition: number): { content: string; nextPosition: number } {
        const result: string[] = ['/', '*'];
        let position = startPosition + 2;
        
        while (position < sql.length - 1) {
            const char = sql[position];
            result.push(char);
            
            if (char === '*' && sql[position + 1] === '/') {
                result.push('/');
                position += 2;
                break;
            }
            position++;
        }
        
        return { content: result.join(''), nextPosition: position };
    }
    
    /**
     * Check if character code can start an identifier
     */
    private isIdentifierStartChar(charCode: number): boolean {
        return (charCode >= 65 && charCode <= 90) ||   // A-Z
               (charCode >= 97 && charCode <= 122) ||  // a-z
               (charCode === 95);                       // _
    }
    
    /**
     * Check if character code can be part of an identifier
     */
    private isIdentifierChar(charCode: number): boolean {
        return (charCode >= 65 && charCode <= 90) ||   // A-Z
               (charCode >= 97 && charCode <= 122) ||  // a-z
               (charCode >= 48 && charCode <= 57) ||   // 0-9
               (charCode === 95);                       // _
    }
    
    /**
     * Check if the identifier matches at the given position (case-insensitive)
     */
    private matchesIdentifierAt(sql: string, position: number, identifier: string): boolean {
        if (position + identifier.length > sql.length) {
            return false;
        }
        
        // Case-insensitive comparison
        for (let i = 0; i < identifier.length; i++) {
            const sqlChar = sql.charCodeAt(position + i);
            const idChar = identifier.charCodeAt(i);
            
            // Convert both to lowercase for comparison
            const sqlLower = sqlChar >= 65 && sqlChar <= 90 ? sqlChar + 32 : sqlChar;
            const idLower = idChar >= 65 && idChar <= 90 ? idChar + 32 : idChar;
            
            if (sqlLower !== idLower) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Validate word boundaries
     */
    private hasValidWordBoundaries(beforeChar: string | null, afterChar: string | null): boolean {
        const isValidBefore = beforeChar === null || !this.isIdentifierChar(beforeChar.charCodeAt(0));
        const isValidAfter = afterChar === null || !this.isIdentifierChar(afterChar.charCodeAt(0));
        return isValidBefore && isValidAfter;
    }
    
    /**
     * Counts word boundary occurrences of an identifier in SQL
     * @param sql SQL string to search
     * @param identifier Identifier to count
     * @returns Number of occurrences
     */
    private countWordOccurrences(sql: string, identifier: string): number {
        let count = 0;
        let position = 0;
        const sqlLength = sql.length;
        const idLength = identifier.length;
        
        while (position <= sqlLength - idLength) {
            if (this.matchesIdentifierAt(sql, position, identifier)) {
                const beforePosition = position - 1;
                const afterPosition = position + idLength;
                
                const beforeChar = beforePosition >= 0 ? sql[beforePosition] : null;
                const afterChar = afterPosition < sqlLength ? sql[afterPosition] : null;
                
                if (this.hasValidWordBoundaries(beforeChar, afterChar)) {
                    count++;
                }
            }
            position++;
        }
        
        return count;
    }
}

