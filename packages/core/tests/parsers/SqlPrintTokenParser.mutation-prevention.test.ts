import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlPrintTokenParser } from '../../src/parsers/SqlPrintTokenParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlPrintTokenParser - Mutation Prevention', () => {
    describe('visitSelectItem should not mutate source objects', () => {
        it('should preserve positionedComments after multiple visits', () => {
            const selectSQL = `SELECT /* before */ column1 /* after */ FROM table1`;
            const query = SelectQueryParser.parse(selectSQL);
            const parser = new SqlPrintTokenParser();

            // Get initial state
            const selectItem = (query as any).selectClause.items[0];
            const initialComments = JSON.parse(JSON.stringify(selectItem.positionedComments));

            // First visit
            const token1 = parser.visit(query);

            // Verify comments are preserved after first visit
            expect(selectItem.positionedComments).toEqual(initialComments);

            // Second visit should still work
            const token2 = parser.visit(query);

            // Verify comments are still preserved after second visit
            expect(selectItem.positionedComments).toEqual(initialComments);

            // Count comment tokens in both results
            const countCommentTokens = (token: any): number => {
                let count = 0;
                if (token.type === 6) count++; // comment type
                if (token.innerTokens) {
                    for (const inner of token.innerTokens) {
                        count += countCommentTokens(inner);
                    }
                }
                return count;
            };

            const commentCount1 = countCommentTokens(token1);
            const commentCount2 = countCommentTokens(token2);

            expect(commentCount1).toBe(2); // 'before' and 'after'
            expect(commentCount2).toBe(2); // should be same
            expect(commentCount1).toBe(commentCount2);
        });

        it('should handle multiple SelectItems without cross-contamination', () => {
            const selectSQL = `SELECT
                /* c1 */ col1 /* c2 */,
                /* c3 */ col2 /* c4 */
                FROM table1`;
            const query = SelectQueryParser.parse(selectSQL);
            const parser = new SqlPrintTokenParser();

            // Get initial state
            const selectItem1 = (query as any).selectClause.items[0];
            const selectItem2 = (query as any).selectClause.items[1];
            const initialComments1 = JSON.parse(JSON.stringify(selectItem1.positionedComments));
            const initialComments2 = JSON.parse(JSON.stringify(selectItem2.positionedComments));

            // Multiple visits
            parser.visit(query);
            parser.visit(query);

            // Verify both items preserve their comments
            expect(selectItem1.positionedComments).toEqual(initialComments1);
            expect(selectItem2.positionedComments).toEqual(initialComments2);
        });
    });

    describe('Integration with SqlFormatter - Comment Preservation', () => {
        it('should preserve all comments in after-comma formatting', () => {
            const complexSQL = `select
/*c11*//*c12*/c1 /* c13 */ /* c14 */
, /*c21 */c2/*c22*//*c24*/
 from a`;

            const query = SelectQueryParser.parse(complexSQL);

            const afterFormatter = new SqlFormatter({
                exportComment: true,
                commaBreak: 'after',
                keywordCase: 'upper',
                newline: '\n'
            });

            const result = afterFormatter.format(query);

            // Verify all comments are preserved
            expect(result.formattedSql).toContain('/* c11 */');
            expect(result.formattedSql).toContain('/* c12 */');
            expect(result.formattedSql).toContain('/* c13 */');
            expect(result.formattedSql).toContain('/* c14 */');
            expect(result.formattedSql).toContain('/* c21 */');
            expect(result.formattedSql).toContain('/* c22 */');
            expect(result.formattedSql).toContain('/* c24 */');
        });

        it('should preserve comments consistently across different comma styles', () => {
            const testSQL = `SELECT
                /* first */ column1 /* after1 */,
                /* second */ column2 /* after2 */
                FROM table1`;

            const query = SelectQueryParser.parse(testSQL);

            const beforeFormatter = new SqlFormatter({
                exportComment: true,
                commaBreak: 'before',
                newline: '\n'
            });

            const afterFormatter = new SqlFormatter({
                exportComment: true,
                commaBreak: 'after',
                newline: '\n'
            });

            const beforeResult = beforeFormatter.format(query);
            const afterResult = afterFormatter.format(query);

            // Both should preserve all comments
            const expectedComments = ['/* first */', '/* after1 */', '/* second */', '/* after2 */'];

            for (const comment of expectedComments) {
                expect(beforeResult.formattedSql).toContain(comment);
                expect(afterResult.formattedSql).toContain(comment);
            }
        });

        it('should not lose comments when same query is formatted multiple times', () => {
            const testSQL = `SELECT /* test */ id /* end */ FROM users`;
            const query = SelectQueryParser.parse(testSQL);

            const formatter = new SqlFormatter({
                exportComment: true,
                commaBreak: 'after'
            });

            // Format same query multiple times
            const result1 = formatter.format(query);
            const result2 = formatter.format(query);
            const result3 = formatter.format(query);

            // All results should contain comments
            expect(result1.formattedSql).toContain('/* test */');
            expect(result1.formattedSql).toContain('/* end */');

            expect(result2.formattedSql).toContain('/* test */');
            expect(result2.formattedSql).toContain('/* end */');

            expect(result3.formattedSql).toContain('/* test */');
            expect(result3.formattedSql).toContain('/* end */');

            // Results should be identical
            expect(result1.formattedSql).toBe(result2.formattedSql);
            expect(result2.formattedSql).toBe(result3.formattedSql);
        });
    });

    describe('Regression Prevention', () => {
        it('should handle complex nested comments without losing SelectItem comments', () => {
            const nestedSQL = `SELECT /* outer1 */ (col1) /* outer2 */ FROM table1`;

            const query = SelectQueryParser.parse(nestedSQL);
            const parser = new SqlPrintTokenParser();

            // Focus on SelectItem comments which is what we fixed
            const selectItem = (query as any).selectClause.items[0];
            const initialComments = JSON.parse(JSON.stringify(selectItem.positionedComments));

            // Multiple visits
            parser.visit(query);
            parser.visit(query);

            // SelectItem comments should be preserved (this is the core fix)
            expect(selectItem.positionedComments).toEqual(initialComments);

            // The key test: comments should not be null after multiple visits
            expect(selectItem.positionedComments).not.toBeNull();
            expect(selectItem.positionedComments.length).toBeGreaterThan(0);
        });

        it('should preserve state across different parser instances', () => {
            const testSQL = `SELECT /* comment */ column FROM table`;
            const query = SelectQueryParser.parse(testSQL);

            const parser1 = new SqlPrintTokenParser();
            const parser2 = new SqlPrintTokenParser();

            const selectItem = (query as any).selectClause.items[0];
            const initialComments = JSON.parse(JSON.stringify(selectItem.positionedComments));

            // Use different parser instances
            parser1.visit(query);
            expect(selectItem.positionedComments).toEqual(initialComments);

            parser2.visit(query);
            expect(selectItem.positionedComments).toEqual(initialComments);

            // Original parser should still work
            parser1.visit(query);
            expect(selectItem.positionedComments).toEqual(initialComments);
        });
    });
});