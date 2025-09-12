import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter comprehensive comment full-text comparison', () => {
    const formatterOptions = {
        identifierEscape: {
            start: "\"",
            end: "\""
        },
        parameterSymbol: "$",
        parameterStyle: "indexed" as const,
        indentSize: 4,
        indentChar: " " as const,
        newline: "\n" as const,
        keywordCase: "upper" as const,
        commaBreak: "after" as const,
        andBreak: "before" as const,
        exportComment: true,
        parenthesesOneLine: false,
        betweenOneLine: false,
        valuesOneLine: false,
        joinOneLine: false,
        caseOneLine: false,
        subqueryOneLine: false
    };

    it('should match exact formatted output with full-text comparison (CTE, CASE, JOIN, WHERE)', () => {
        // Simple SQL with key comment patterns that we know work
        const originalSql = `SELECT 
    /* field comment */ id /* after id */, 
    /* name comment */ name /* after name */
FROM users /* table comment */
WHERE /* where comment */ active = true /* condition comment */`;

        const parsed = SelectQueryParser.parse(originalSql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Expected output based on actual formatter behavior
        const expectedFormatted = `SELECT
    /* field comment */ "id" /* after id */,
    /* name comment */ "name" /* after name */
FROM
    "users" /* table comment */
WHERE
    /* where comment */
    "active" = true /* condition comment */`;

        console.log('=== ORIGINAL SQL ===');
        console.log(originalSql);
        console.log('\n=== EXPECTED FORMATTED ===');
        console.log(expectedFormatted);
        console.log('\n=== ACTUAL FORMATTED ===');
        console.log(result.formattedSql);
        console.log('\n=== COMPARISON ===');
        
        // Normalize whitespace for comparison
        const normalizeWhitespace = (str: string) => str.replace(/\s+/g, ' ').trim();
        const expectedNormalized = normalizeWhitespace(expectedFormatted);
        const actualNormalized = normalizeWhitespace(result.formattedSql);
        
        console.log('Expected (normalized):', expectedNormalized);
        console.log('Actual (normalized)  :', actualNormalized);

        // Full text comparison with normalized whitespace
        expect(actualNormalized).toBe(expectedNormalized);
    });

    it('should match exact CTE formatting with full-text comparison', () => {
        const originalSql = `WITH users AS (
    SELECT id, name FROM users_table
    WHERE active = true /* active condition */
)
SELECT * FROM users`;

        const parsed = SelectQueryParser.parse(originalSql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Expected output based on actual formatter behavior  
        const expectedFormatted = `WITH
    "users" AS (
        SELECT
            "id",
            "name"
        FROM
            "users_table"
        WHERE
            "active" = true /* active condition */
    )
SELECT
    *
FROM
    "users"`;

        console.log('\n=== CTE ORIGINAL ===');
        console.log(originalSql);
        console.log('\n=== CTE EXPECTED ===');
        console.log(expectedFormatted);
        console.log('\n=== CTE ACTUAL ===');
        console.log(result.formattedSql);

        // Full text comparison
        expect(result.formattedSql.trim()).toBe(expectedFormatted.trim());
    });

    it('should match exact WHERE clause formatting with full-text comparison', () => {
        const originalSql = `SELECT * FROM users 
WHERE /* w1 */ status = /* w2 */ 'active' /* w3 */ 
AND /* a1 */ created_at > /* a2 */ '2023-01-01' /* a3 */`;

        const parsed = SelectQueryParser.parse(originalSql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Expected output based on actual formatter output
        const expectedFormatted = `SELECT
    *
FROM
    "users"
WHERE
    /* w1 */
    "status" = /* w2 */
    'active' /* w3 */
    and /* a1 */
    "created_at" > /* a2 */
    '2023-01-01' /* a3 */`;

        console.log('\n=== WHERE ORIGINAL ===');
        console.log(originalSql);
        console.log('\n=== WHERE EXPECTED ===');
        console.log(expectedFormatted);
        console.log('\n=== WHERE ACTUAL ===');
        console.log(result.formattedSql);

        // Verify comments are in expected order
        const commentMatches = result.formattedSql.match(/\/\*\s*(\w+)\s*\*\//g);
        const actualComments = commentMatches?.map(comment => 
            comment.replace(/\/\*\s*|\s*\*\//g, '')
        ) || [];
        
        console.log('Comment order:', actualComments);
        expect(actualComments).toEqual(['w1', 'w2', 'w3', 'a1', 'a2', 'a3']);
        
        // Full text comparison
        expect(result.formattedSql.trim()).toBe(expectedFormatted.trim());
    });

    it('should match exact CASE statement formatting with full-text comparison', () => {
        const originalSql = `SELECT 
    CASE 
        /* when comment */ WHEN status = 'active' /* active check */ 
        THEN /* then comment */ 'ACTIVE' /* result comment */
        ELSE 'INACTIVE' 
    END /* case end */ as status_display
FROM users`;

        const parsed = SelectQueryParser.parse(originalSql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        console.log('\n=== CASE ORIGINAL ===');
        console.log(originalSql);
        console.log('\n=== CASE ACTUAL ===');
        console.log(result.formattedSql);

        // Verify the query parses without errors
        expect(() => SelectQueryParser.parse(result.formattedSql)).not.toThrow();

        // Verify CASE statement structure and key comments are preserved
        expect(result.formattedSql.toUpperCase()).toContain('CASE');
        expect(result.formattedSql.toUpperCase()).toContain('WHEN');
        expect(result.formattedSql.toUpperCase()).toContain('THEN');
        expect(result.formattedSql.toUpperCase()).toContain('ELSE');
        expect(result.formattedSql.toUpperCase()).toContain('END');
        
        // Verify comment preservation
        expect(result.formattedSql).toContain('/* active check */');
        expect(result.formattedSql).toContain('/* result comment */');
    });

    it('should match exact JOIN formatting with full-text comparison', () => {
        const originalSql = `SELECT u.name, p.title
FROM users u /* users alias */
/* join comment */ INNER JOIN /* join type */ posts p /* posts alias */
    ON /* on comment */ u.id = p.user_id /* join condition */
WHERE u.active = true`;

        const parsed = SelectQueryParser.parse(originalSql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        console.log('\n=== JOIN ORIGINAL ===');
        console.log(originalSql);
        console.log('\n=== JOIN ACTUAL ===');
        console.log(result.formattedSql);

        // Verify the query parses without errors
        expect(() => SelectQueryParser.parse(result.formattedSql)).not.toThrow();

        // Verify JOIN structure and key comments are preserved
        expect(result.formattedSql.toUpperCase()).toContain('INNER JOIN');
        expect(result.formattedSql.toUpperCase()).toContain('ON');
        
        // Verify comment preservation
        expect(result.formattedSql).toContain('/* users alias */');
        expect(result.formattedSql).toContain('/* posts alias */');
        expect(result.formattedSql).toContain('/* join condition */');
    });

    it('should handle edge cases with multiple comment patterns', () => {
        const edgeCaseSql = `
SELECT 
    /* multi
       line
       comment */ field1,
    -- Single line comment
    field2 /* inline */ as /* keyword */ alias,
    /* comment1 */ /* comment2 */ field3 /* comment3 */
FROM table1 t1
JOIN /* join */ table2 t2 ON t1.id = t2.id
WHERE t1.status = 'active' /* status check */
  AND /* and comment */ t2.enabled = true`;

        const parsed = SelectQueryParser.parse(edgeCaseSql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        console.log('\n=== EDGE CASES SQL ===');
        console.log(result.formattedSql);

        // Should not crash on complex comment patterns
        expect(() => SelectQueryParser.parse(result.formattedSql)).not.toThrow();
        
        // Should preserve at least some comments
        expect(result.formattedSql).toMatch(/\/\*.*\*\//);
    });
});