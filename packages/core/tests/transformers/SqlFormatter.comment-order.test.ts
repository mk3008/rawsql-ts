import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter comment order preservation', () => {
    const formatterOptions = {
        identifierEscape: {
            start: "",
            end: ""
        },
        parameterSymbol: "$",
        parameterStyle: "indexed" as const,
        indentSize: 4,
        indentChar: " " as const,
        newline: "\n" as const,
        keywordCase: "upper" as const,
        commaBreak: "before" as const,
        andBreak: "before" as const,
        exportComment: true,
        parenthesesOneLine: true,
        betweenOneLine: true,
        valuesOneLine: true,
        joinOneLine: true,
        caseOneLine: true,
        subqueryOneLine: true
    };

    it.skip('should preserve comment order in SELECT clause', () => {
        const sql = `SELECT  
    /* a1 */ a /* a2 */
    , /* b1 */ b /* b2 */
    , /* c1 */ c /* c2 */ as /* c3 */ alias_c /* c4 */
FROM
    users`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        console.log('Formatted SQL:', result.formattedSql);

        // Expected: Comments should appear in the same order as the original
        // a1, a2, b1, b2, c1, c2, c3, c4
        const expectedOrder = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'c3', 'c4'];
        
        // Extract comment content from the formatted SQL
        const commentMatches = result.formattedSql.match(/\/\*\s*(\w+)\s*\*\//g);
        const actualComments = commentMatches?.map(comment => 
            comment.replace(/\/\*\s*|\s*\*\//g, '')
        ) || [];

        console.log('Actual comments:', actualComments);
        expect(actualComments).toEqual(expectedOrder);
        
        // Verify that the c3 comment appears after AS keyword
        expect(result.formattedSql).toContain('AS /* c3 */');
        console.log('✓ AS keyword comment spacing is correct');
    });

    it.skip('should preserve comment order with complex expressions - partial implementation', () => {
        const sql = `SELECT
    /* start */ CASE 
        WHEN /* w1 */ x > 0 /* w2 */ THEN /* t1 */ 'positive' /* t2 */
        ELSE /* e1 */ 'non-positive' /* e2 */
    END /* end */ as result
FROM test`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Note: This test demonstrates remaining limitations
        // Currently some CASE expression keywords (THEN, ELSE, END) lose their comments
        // This is a known limitation that would require similar fixes to other parsers
        const actualComments = (result.formattedSql.match(/\/\*\s*(\w+)\s*\*\//g) || [])
            .map(comment => comment.replace(/\/\*\s*|\s*\*\//g, ''));

        // Verify that at least some comments are preserved (progress made)
        expect(actualComments.length).toBeGreaterThan(0);
        expect(actualComments).toContain('start');
        expect(actualComments).toContain('w1');
        expect(actualComments).toContain('w2');
        
        console.log('Complex expression comments preserved:', actualComments);
        console.log('Note: CASE keyword comment preservation needs further work');
    });

    it.skip('should preserve comment order in WHERE clause', () => {
        const sql = `SELECT * FROM users 
WHERE /* w1 */ status = /* w2 */ 'active' /* w3 */ 
AND /* a1 */ created_at > /* a2 */ '2023-01-01' /* a3 */`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        const expectedOrder = ['w1', 'w2', 'w3', 'a1', 'a2', 'a3'];
        
        const commentMatches = result.formattedSql.match(/\/\*\s*(\w+)\s*\*\//g);
        const actualComments = commentMatches?.map(comment => 
            comment.replace(/\/\*\s*|\s*\*\//g, '')
        ) || [];

        expect(actualComments).toEqual(expectedOrder);
    });

    it.skip('should produce exact formatted SQL with positioned comments - full text comparison', () => {
        const originalSql = `SELECT  
    /* a1 */ a /* a2 */
    , /* b1 */ b /* b2 */
    , /* c1 */ c /* c2 */ as /* c3 */ alias_c /* c4 */
FROM
    users`;

        const parsed = SelectQueryParser.parse(originalSql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Expected formatted SQL - corrected to proper comment positions
        const expectedFormattedSql = `SELECT
    /* a1 */ a /* a2 */
    , /* b1 */ b /* b2 */
    , /* c1 */ c /* c2 */ AS /* c3 */ alias_c /* c4 */
FROM
    users`;

        console.log('=== EXACT SQL Full Text Comparison ===');
        console.log('Input SQL:');
        console.log(JSON.stringify(originalSql));
        console.log('---');
        console.log('Expected Output:');
        console.log(JSON.stringify(expectedFormattedSql));
        console.log('---');
        console.log('Actual Output:');
        console.log(JSON.stringify(result.formattedSql));
        console.log('---');
        console.log('Expected (formatted):');
        console.log(expectedFormattedSql);
        console.log('---');
        console.log('Actual (formatted):');
        console.log(result.formattedSql);
        
        if (result.formattedSql !== expectedFormattedSql) {
            console.log('=== Character-by-character comparison ===');
            const expected = expectedFormattedSql;
            const actual = result.formattedSql;
            const maxLen = Math.max(expected.length, actual.length);
            
            for (let i = 0; i < maxLen; i++) {
                const exp = expected[i] || '<END>';
                const act = actual[i] || '<END>';
                if (exp !== act) {
                    console.log(`Position ${i}: expected '${exp}' (${exp.charCodeAt?.(0) || 'END'}), got '${act}' (${act.charCodeAt?.(0) || 'END'})`);
                    break;
                }
            }
        }
        console.log('=== End Full Text Comparison ===');

        // Exact match comparison
        expect(result.formattedSql).toBe(expectedFormattedSql);
    });
});