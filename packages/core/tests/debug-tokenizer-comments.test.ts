import { describe, it, expect } from 'vitest';
import { SqlTokenizer } from '../src/parsers/SqlTokenizer';

describe('Debug Tokenizer Comment Handling', () => {
    it('should show how tokenizer handles different comment types', () => {
        // Test SQL with both line and block comments
        const sql = `-- Main query: Sales analysis report
WITH /* Raw data preparation */ raw_sales AS (
    SELECT sale_id FROM sales
)
/* Main SELECT statement */
SELECT * FROM raw_sales`;

        console.log('\n=== Original SQL ===');
        console.log(sql);

        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexmes();

        console.log('\n=== All Tokens with Comments ===');
        lexemes.forEach((lexeme, index) => {
            if (lexeme.comments && lexeme.comments.length > 0) {
                console.log(`Token[${index}]:`, {
                    value: lexeme.value,
                    type: lexeme.type,
                    comments: lexeme.comments,
                    position: lexeme.position
                });
            }
        });

        console.log('\n=== First 10 Tokens ===');
        lexemes.slice(0, 10).forEach((lexeme, index) => {
            console.log(`[${index}] "${lexeme.value}" (type: ${lexeme.type}) comments: ${JSON.stringify(lexeme.comments)}`);
        });

        expect(lexemes.length).toBeGreaterThan(0);
    });

    it('should test simple line comment handling', () => {
        const sql = `-- Header comment
SELECT * FROM users`;

        console.log('\n=== Simple Line Comment SQL ===');
        console.log(sql);

        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexmes();

        console.log('\n=== Simple Tokens ===');
        lexemes.forEach((lexeme, index) => {
            console.log(`[${index}] "${lexeme.value}" (type: ${lexeme.type}) comments: ${JSON.stringify(lexeme.comments)}`);
        });

        expect(lexemes.length).toBeGreaterThan(0);
    });
});