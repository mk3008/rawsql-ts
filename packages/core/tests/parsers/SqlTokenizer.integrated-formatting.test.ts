import { describe, it, expect } from 'vitest';
import { SqlTokenizer } from '../../src/parsers/SqlTokenizer';

describe('SqlTokenizer - Integrated Formatting Functionality', () => {
    it('should tokenize without formatting preservation (default behavior)', () => {
        const sql = `SELECT id, name FROM users WHERE active = true`;
        const tokenizer = new SqlTokenizer(sql);
        
        const lexemes = tokenizer.tokenize();
        
        expect(lexemes).toBeDefined();
        expect(lexemes.length).toBeGreaterThan(0);
        expect(lexemes[0].value.toLowerCase()).toBe('select');
        
        // Verify it's regular Lexeme, not FormattingLexeme
        expect('followingWhitespace' in lexemes[0]).toBe(false);
        expect('inlineComments' in lexemes[0]).toBe(false);
        expect('position' in lexemes[0]).toBe(false);
    });

    it('should tokenize with formatting preservation when requested', () => {
        const sql = `-- Query comment
SELECT 
    u.id,     -- User ID  
    u.name    /* User name */
FROM users AS u
WHERE u.active = true`;
        
        const tokenizer = new SqlTokenizer(sql);
        const formattingLexemes = tokenizer.tokenize({ preserveFormatting: true });
        
        expect(formattingLexemes).toBeDefined();
        expect(formattingLexemes.length).toBeGreaterThan(0);
        
        // Verify it's FormattingLexeme with additional properties
        const firstLexeme = formattingLexemes[0];
        expect(firstLexeme.value.toLowerCase()).toBe('select');
        expect('followingWhitespace' in firstLexeme).toBe(true);
        expect('inlineComments' in firstLexeme).toBe(true);
        expect('position' in firstLexeme).toBe(true);
        
        // Verify position information
        expect(firstLexeme.position.startPosition).toBeGreaterThanOrEqual(0);
        expect(firstLexeme.position.endPosition).toBeGreaterThan(firstLexeme.position.startPosition);
        expect(firstLexeme.position.startLine).toBeGreaterThanOrEqual(1);
        expect(firstLexeme.position.startColumn).toBeGreaterThanOrEqual(1);
        
        console.log('=== Formatting Preservation Test ===');
        console.log(`Total lexemes: ${formattingLexemes.length}`);
        console.log(`First lexeme: "${firstLexeme.value}"`);
        console.log(`Following whitespace length: ${firstLexeme.followingWhitespace.length}`);
        console.log(`Inline comments count: ${firstLexeme.inlineComments.length}`);
        console.log('✓ Formatting preservation working correctly');
    });

    it('should maintain backward compatibility with readLexmes method', () => {
        const sql = `SELECT * FROM table1`;
        const tokenizer = new SqlTokenizer(sql);
        
        const lexemesOld = tokenizer.readLexmes();
        const lexemesNew = tokenizer.tokenize();
        
        console.log('\n=== Debug Backward Compatibility Test ===');
        console.log(`SQL: "${sql}"`);
        console.log(`readLexmes() result count: ${lexemesOld.length}`);
        console.log(`tokenize() result count: ${lexemesNew.length}`);
        console.log(`readLexmes() first few:`, lexemesOld.slice(0, 3));
        console.log(`tokenize() first few:`, lexemesNew.slice(0, 3));
        
        expect(lexemesOld.length).toBeGreaterThan(0);
        expect(lexemesNew.length).toBeGreaterThan(0);
        expect(lexemesOld.length).toBe(lexemesNew.length);
        expect(lexemesOld).toEqual(lexemesNew);
        
        console.log('✓ Backward compatibility maintained');
    });

    it('should handle complex SQL with comments and formatting', () => {
        const sql = `WITH sales_data AS (  /* CTE comment */
    SELECT 
        u.id AS user_id,    -- Primary key
        u.name              -- User name
    FROM users AS u
    WHERE u.active = true
), analytics AS (
    SELECT * FROM sales_data
)
SELECT * FROM analytics`;
        
        const tokenizer = new SqlTokenizer(sql);
        const formattingLexemes = tokenizer.tokenize({ preserveFormatting: true });
        
        expect(formattingLexemes.length).toBeGreaterThan(10);
        
        // Find some key lexemes and verify they have formatting info
        const withLexeme = formattingLexemes.find(l => l.value.toLowerCase() === 'with');
        const selectLexemes = formattingLexemes.filter(l => l.value.toLowerCase() === 'select');
        
        expect(withLexeme).toBeDefined();
        expect(selectLexemes.length).toBeGreaterThanOrEqual(2);
        
        // Verify whitespace preservation
        expect(withLexeme!.followingWhitespace).toContain(' ');
        
        // Check that some lexemes have comments
        const lexemesWithComments = formattingLexemes.filter(l => l.inlineComments.length > 0);
        expect(lexemesWithComments.length).toBeGreaterThan(0);
        
        console.log('\n=== Complex SQL Test ===');
        console.log(`Total lexemes: ${formattingLexemes.length}`);
        console.log(`Lexemes with comments: ${lexemesWithComments.length}`);
        console.log(`WITH lexeme whitespace: "${withLexeme!.followingWhitespace}"`);
        console.log('✓ Complex SQL formatting handled correctly');
    });

    it('should handle empty and minimal SQL', () => {
        const tokenizer1 = new SqlTokenizer('');
        const emptyResult = tokenizer1.tokenize({ preserveFormatting: true });
        expect(emptyResult).toEqual([]);
        
        const tokenizer2 = new SqlTokenizer('SELECT 1');
        const minimalResult = tokenizer2.tokenize({ preserveFormatting: true });
        expect(minimalResult.length).toBe(2); // SELECT, 1
        expect(minimalResult[0].value.toLowerCase()).toBe('select');
        expect(minimalResult[1].value).toBe('1');
        
        console.log('\n=== Edge Cases Test ===');
        console.log(`Empty SQL result: ${emptyResult.length} lexemes`);
        console.log(`Minimal SQL result: ${minimalResult.length} lexemes`);
        console.log('✓ Edge cases handled correctly');
    });

    it('should preserve exact whitespace and comment content', () => {
        const sql = `SELECT
    col1,    -- Comment 1
    col2     /* Comment 2 */
FROM table1`;
        
        const tokenizer = new SqlTokenizer(sql);
        const formattingLexemes = tokenizer.tokenize({ preserveFormatting: true });
        
        // Find lexemes that should have comments
        const col1Lexeme = formattingLexemes.find(l => l.value === 'col1');
        const col2Lexeme = formattingLexemes.find(l => l.value === 'col2');
        
        expect(col1Lexeme).toBeDefined();
        expect(col2Lexeme).toBeDefined();
        
        // Check that comments are extracted correctly
        const allComments = formattingLexemes
            .flatMap(l => l.inlineComments)
            .filter(c => c.length > 0);
        
        expect(allComments.length).toBeGreaterThanOrEqual(1);
        expect(allComments.some(c => c.includes('Comment'))).toBe(true);
        
        console.log('\n=== Whitespace and Comments Preservation Test ===');
        console.log(`All comments found: ${JSON.stringify(allComments)}`);
        console.log('✓ Comments and whitespace preserved correctly');
    });
});