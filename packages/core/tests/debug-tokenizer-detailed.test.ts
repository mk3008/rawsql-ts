import { describe, it, expect } from 'vitest';
import { SqlTokenizer } from '../src/parsers/SqlTokenizer';

describe('Debug Tokenizer Detailed', () => {
    it('should debug the tokenization step by step', () => {
        // Simple case first - only line comment
        const sql = `-- Header comment
SELECT * FROM users`;

        console.log('\n=== Testing Simple Line Comment Case ===');
        console.log('SQL:', sql);

        // Create a custom tokenizer for debugging
        const tokenizer = new (SqlTokenizer as any)(sql);

        // Try to access the tokenizeBasic method if possible (it's private but we can try)
        console.log('Tokenizer created for:', sql);

        const lexemes = tokenizer.readLexmes();

        console.log('\n=== Final Lexemes ===');
        lexemes.forEach((lexeme, index) => {
            console.log(`[${index}] Token: "${lexeme.value}" Type: ${lexeme.type}`);
            console.log(`      Comments: ${JSON.stringify(lexeme.comments)}`);
            console.log(`      PositionedComments: ${JSON.stringify(lexeme.positionedComments)}`);
        });

        expect(lexemes.length).toBeGreaterThan(0);
    });

    it('should test WITH clause specifically', () => {
        const sql = `-- Header comment
WITH cte AS (SELECT 1)
SELECT * FROM cte`;

        console.log('\n=== Testing WITH Clause Case ===');
        console.log('SQL:', sql);

        const tokenizer = new SqlTokenizer(sql);
        const lexemes = tokenizer.readLexmes();

        console.log('\n=== WITH Clause Lexemes ===');
        lexemes.slice(0, 5).forEach((lexeme, index) => {
            console.log(`[${index}] "${lexeme.value}" (${lexeme.type})`);
            console.log(`      comments: ${JSON.stringify(lexeme.comments)}`);
            console.log(`      positionedComments: ${JSON.stringify(lexeme.positionedComments)}`);
        });

        expect(lexemes.length).toBeGreaterThan(0);
    });
});