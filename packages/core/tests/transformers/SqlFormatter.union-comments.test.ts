import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter - UNION Comments (Bug 2)', () => {
    describe('Basic UNION Comment Preservation', () => {
        test('should preserve comment before second SELECT in UNION', () => {
            const inputSql = `
                select col1 from table1
                union
                --important comment
                select col1 from table2
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('important comment');
            expect(result.formattedSql).toContain('union /* important comment */');
        });

        test('should preserve comment after UNION keyword', () => {
            const inputSql = `
                select col1 from table1
                union --after union comment
                select col1 from table2
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('after union comment');
            expect(result.formattedSql).toContain('union /* after union comment */');
        });
    });

    describe('Multiple UNION Comments', () => {
        test('should handle multiple comments in complex UNION query', () => {
            const inputSql = `
                -- First query comment
                select col1 from table1
                union -- Union comment
                -- Before second select
                select col1 from table2
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('First query comment');
            expect(result.formattedSql).toContain('Union comment');
            expect(result.formattedSql).toContain('Before second select');
        });
    });

    describe('Different UNION Types', () => {
        test('should preserve comments with UNION ALL', () => {
            const inputSql = `
                select col1 from table1
                union all -- union all comment
                select col1 from table2
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('union all comment');
        });

        test('should preserve comments with INTERSECT', () => {
            const inputSql = `
                select col1 from table1
                intersect -- intersect comment
                select col1 from table2
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('intersect comment');
        });

        test('should preserve comments with EXCEPT', () => {
            const inputSql = `
                select col1 from table1
                except -- except comment
                select col1 from table2
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('except comment');
        });
    });

    describe('Multiple UNION Operations', () => {
        test('should preserve comments in chained UNION operations', () => {
            const inputSql = `
                select col1 from table1
                union -- first union
                select col1 from table2  
                union -- second union
                select col1 from table3
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('first union');
            expect(result.formattedSql).toContain('second union');
        });
    });

    describe('Full Output Verification', () => {
        test('should show complete formatted output with UNION comments', () => {
            const inputSql = `
                -- First query comment
                select col1, col2 from table1
                union -- Union operation comment
                -- Second query comment  
                select col1, col2 from table2
                -- Final comment
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            console.log('=== Input SQL ===');
            console.log(inputSql);
            console.log('\n=== Formatted Output ===');
            console.log(result.formattedSql);
            console.log('\n=== Verification ===');
            
            // 個別のコメントが含まれていることを確認
            expect(result.formattedSql).toContain('First query comment');
            expect(result.formattedSql).toContain('Union operation comment');
            expect(result.formattedSql).toContain('Second query comment');
            
            // UNION演算子にコメントが付いていることを確認
            expect(result.formattedSql).toMatch(/union\s*\/\*.*Union operation comment.*\*\//);
        });
    });

    describe('Edge Cases', () => {
        test('should work when exportComment is false', () => {
            const inputSql = `
                select col1 from table1
                union -- this comment should not appear
                select col1 from table2
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: false });
            const result = formatter.format(query);
            
            expect(result.formattedSql).not.toContain('this comment should not appear');
            expect(result.formattedSql).toContain('union');
        });

        test('should handle UNION without comments', () => {
            const inputSql = `
                select col1 from table1
                union
                select col1 from table2
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('union');
            expect(result.formattedSql).not.toContain('/*');
        });
    });
});