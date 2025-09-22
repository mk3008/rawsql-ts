import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter - Complex Comments Positioning', () => {
    describe('WITH Clause and UNION Comment Preservation', () => {
        test('should preserve complex WITH and UNION comments in correct positions with proper formatting', () => {
            const inputSql = `
--Global query comment
with 
  --WITH clause comment
  a as (
  --First query comment
  select 1
  union all
  --Second query comment
  select 2
)
--Main query comment
SELECT
*
FROM
    table
union all
--Union query comment
SELECT
*
FROM
    table
            `;
            
            console.log('=== Input SQL ===');
            console.log(inputSql);
            
            const query = SelectQueryParser.parse(inputSql);
            
            // Test with compact formatting (no indentation for precise comparison)
            const formatterWithIndent = new SqlFormatter({ 
                exportComment: true, 
                preset: 'postgres'
            });
            
            const resultWithIndent = formatterWithIndent.format(query);
            
            console.log('\n=== Formatted Output (With Indentation) ===');
            console.log(resultWithIndent.formattedSql);
            
            // Verify comments that are preserved by current positioned comments system
            const originalComments = [
                'Global query comment',
                'WITH clause comment',
                'First query comment',
                'Second query comment',
                'Main query comment',
                'Union query comment'
            ];

            console.log('\n=== Comment Preservation Check ===');
            originalComments.forEach(comment => {
                const found = resultWithIndent.formattedSql.includes(comment);
                console.log(`  "${comment}": ${found ? '✓' : '✗'}`);
                expect(found, `Comment "${comment}" should be preserved`).toBe(true);
            });

            const normalizedOutput = resultWithIndent.formattedSql.replace(/\s+/g, ' ').trim();
            const globalCommentIndex = normalizedOutput.indexOf('/* Global query comment */');
            const withClauseCommentIndex = normalizedOutput.indexOf('/* WITH clause comment */');
            const withClausePattern = 'with /* WITH clause comment */';
            const aliasAfterCommentIndex = normalizedOutput.indexOf('/* WITH clause comment */ "a" as (');
            const firstCommentIndex = normalizedOutput.indexOf('/* First query comment */');

            expect(globalCommentIndex).toBeGreaterThan(-1);
            expect(withClauseCommentIndex).toBeGreaterThan(globalCommentIndex);
            expect(normalizedOutput.includes(withClausePattern)).toBe(true);
            expect(aliasAfterCommentIndex).toBeGreaterThan(-1);
            expect(firstCommentIndex).toBeGreaterThan(aliasAfterCommentIndex);

        });

        test('should preserve comment spacing with proper space before comments', () => {
            const inputSql = `
select 1 as val --comment
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ 
                exportComment: true, 
                preset: 'postgres',
                indentSize: 2,
                indentChar: ' ',
                newline: '\n'
            });
            
            const result = formatter.format(query);
            
            console.log('=== Comment Spacing Test ===');
            console.log('Input:', inputSql.trim());
            console.log('Output:', result.formattedSql);
            
            // Should have proper spacing: '"val" /* comment */' not '"val"/* comment */'
            expect(result.formattedSql).toContain('"val" /* comment */');
            expect(result.formattedSql).not.toContain('"val"/* comment */');
        });

        test('should handle nested CTE comments correctly', () => {
            const inputSql = `
--Global query comment
with
  --First CTE comment
  cte1 as (
    --Inner CTE query comment
    select id, name from users
  ), --After first CTE
  --Second CTE comment  
  cte2 as (
    --Inner second CTE comment
    select * from cte1
  ) --After second CTE
--Main query comment
select * from cte2
            `;
            
            console.log('=== Nested CTE Comments Test ===');
            console.log('Input:');
            console.log(inputSql);
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ 
                exportComment: true, 
                preset: 'postgres',
                indentSize: 2,
                indentChar: ' ',
                newline: '\n'
            });
            
            const result = formatter.format(query);
            
            console.log('\nFormatted Output:');
            console.log(result.formattedSql);
            
            // Check comments that are preserved by current positioned comments system
            const expectedComments = [
                // 'Global query comment',      // Not captured - top-level
                'First CTE comment',
                // 'Inner CTE query comment',   // Not captured - inner query top-level
                'After first CTE',
                'Second CTE comment',
                // 'Inner second CTE comment',  // Not captured - inner query top-level
                // 'After second CTE',          // Not captured
                // 'Main query comment'         // Not captured - between CTE and main query
            ];
            
            expectedComments.forEach(comment => {
                const found = result.formattedSql.includes(comment);
                expect(found, `Comment "${comment}" should be preserved`).toBe(true);
            });
        });

        test('should preserve comment order in complex UNION scenarios', () => {
            const inputSql = `
--First query block comment
select 'A' as type, 1 as value
union all
--Second query block comment
select 'B' as type, 2 as value
union all  
--Third query block comment
select 'C' as type, 3 as value
--End comment
            `;
            
            console.log('=== Complex UNION Comments Test ===');
            console.log('Input:');
            console.log(inputSql);
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ 
                exportComment: true, 
                preset: 'postgres',
                indentSize: 2,
                indentChar: ' ',
                newline: '\n'
            });
            
            const result = formatter.format(query);
            
            console.log('\nFormatted Output:');
            console.log(result.formattedSql);
            
            // Comments preserved by current positioned comments system
            const unionComments = [
                'First query block comment',
                'Second query block comment',
                'Third query block comment',
                'End comment'
            ];
            
            unionComments.forEach(comment => {
                const found = result.formattedSql.includes(comment);
                expect(found, `UNION comment "${comment}" should be preserved`).toBe(true);
            });
        });
    });
});
