import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { HintClause } from '../../src/models/HintClause';

/**
 * Helper function to validate that the formatted SQL is syntactically valid
 * by attempting to parse it again
 */
function validateSqlSyntax(formattedSql: string): void {
    try {
        // Try to parse the formatted SQL to ensure it's syntactically valid
        const reparsedQuery = SelectQueryParser.parse(formattedSql);
        expect(reparsedQuery).toBeDefined();
    } catch (error) {
        throw new Error(`Generated SQL is syntactically invalid: ${formattedSql}\nError: ${error}`);
    }
}

/**
 * Helper function to perform complete SQL text comparison
 */
function validateCompleteSQL(actualSql: string, expectedSql: string): void {
    // 1. Validate syntax by re-parsing
    validateSqlSyntax(actualSql);
    
    // 2. Normalize whitespace for comparison (but preserve structure)
    const normalizeForComparison = (sql: string) => sql.trim().replace(/\s+/g, ' ');
    
    const normalizedActual = normalizeForComparison(actualSql);
    const normalizedExpected = normalizeForComparison(expectedSql);
    
    // 3. Complete text comparison
    if (normalizedActual !== normalizedExpected) {
        console.log('=== ACTUAL SQL ===');
        console.log(actualSql);
        console.log('=== EXPECTED SQL ===');
        console.log(expectedSql);
        console.log('=== NORMALIZED ACTUAL ===');
        console.log(normalizedActual);
        console.log('=== NORMALIZED EXPECTED ===');
        console.log(normalizedExpected);
    }
    
    expect(normalizedActual).toBe(normalizedExpected);
}

describe('HintClause', () => {
    test('should identify hint clauses correctly', () => {
        expect(HintClause.isHintClause('/*+ INDEX(table idx) */')).toBe(true);
        expect(HintClause.isHintClause('/*+ USE_HASH(users) */')).toBe(true);
        expect(HintClause.isHintClause('/* regular comment */')).toBe(false);
        expect(HintClause.isHintClause('-- line comment')).toBe(false);
        expect(HintClause.isHintClause('/*+*/')).toBe(true); // Empty hint
    });

    test('should extract hint content correctly', () => {
        expect(HintClause.extractHintContent('/*+ INDEX(table idx) */')).toBe('INDEX(table idx)');
        expect(HintClause.extractHintContent('/*+ USE_HASH(users) */')).toBe('USE_HASH(users)');
        expect(HintClause.extractHintContent('/*+   HINT_TEXT   */')).toBe('HINT_TEXT');
    });

    test('should parse single hint clause in SELECT statement', () => {
        // Arrange
        const query = SelectQueryParser.parse(`
            SELECT /*+ INDEX(users idx_name) */ 
                id, name 
            FROM users
        `).toSimpleQuery();

        // Assert
        expect(query.selectClause.hints).toHaveLength(1);
        expect(query.selectClause.hints[0].hintContent).toBe('index(users idx_name)');
    });

    test('should parse multiple hint clauses in SELECT statement', () => {
        // Arrange
        const query = SelectQueryParser.parse(`
            SELECT /*+ INDEX(users idx_name) */ /*+ USE_HASH(users) */
                id, name 
            FROM users
        `).toSimpleQuery();

        // Assert
        expect(query.selectClause.hints).toHaveLength(2);
        expect(query.selectClause.hints[0].hintContent).toBe('index(users idx_name)');
        expect(query.selectClause.hints[1].hintContent).toBe('use_hash(users)');
    });

    test('should format hint clauses correctly', () => {
        // Arrange
        const query = SelectQueryParser.parse(`
            SELECT /*+ INDEX(users idx_name) */ /*+ USE_HASH(users) */
                id, name 
            FROM users
        `).toSimpleQuery();
        const formatter = new SqlFormatter();

        // Act
        const result = formatter.format(query);

        // Assert - Complete SQL comparison
        const expectedSql = 'select /*+ index(users idx_name) */ /*+ use_hash(users) */ "id", "name" from "users"';
        validateCompleteSQL(result.formattedSql, expectedSql);
    });

    test('should work with hint clauses and regular comments together', () => {
        // Arrange
        const query = SelectQueryParser.parse(`
            -- Query comment
            SELECT /*+ INDEX(users idx_name) */ 
                id, name -- Column comment
            FROM users
        `);
        const formatter = new SqlFormatter({ exportComment: true });

        // Act
        const result = formatter.format(query);

        // Assert - Complete SQL comparison
        // Note: Line comment (-- Query comment) is converted to headerComment and becomes block comment
        const expectedSql = '/* Query comment */ select /*+ index(users idx_name) */ "id", "name" /* Column comment */ from "users"';
        validateCompleteSQL(result.formattedSql, expectedSql);
    });

    test('should handle hint clauses with DISTINCT', () => {
        // Arrange
        const query = SelectQueryParser.parse(`
            SELECT /*+ INDEX(users idx_name) */ DISTINCT 
                id, name 
            FROM users
        `);
        const formatter = new SqlFormatter();

        // Act
        const result = formatter.format(query);

        // Assert - Complete SQL comparison
        const expectedSql = 'select /*+ index(users idx_name) */ distinct "id", "name" from "users"';
        validateCompleteSQL(result.formattedSql, expectedSql);
    });
});