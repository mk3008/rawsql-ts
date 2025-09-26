import { expect, test } from 'vitest';
import { SqlTokenizer } from "../../src/parsers/SqlTokenizer";
import { StringUtils } from "../../src/utils/stringUtils";

test('prefix comment', () => {
    // Arrange
    const tokenizer = new SqlTokenizer(`
    /*   
    block comment 1
    block comment 2    
    */
   -- line comment 3
   -- line comment 4
   'test'
    `);

    // Act
    const lexemes = tokenizer.readLexmes();

    // Assert  
    expect(lexemes.length).toBe(1);
    // Check positioned comments
    expect(lexemes[0].positionedComments).toBeDefined();
    const beforePositionedComment = lexemes[0].positionedComments?.find(pc => pc.position === 'before');
    expect(beforePositionedComment).toBeDefined();
    expect(beforePositionedComment!.comments.length).toBe(4);
    expect(beforePositionedComment!.comments[0]).toBe('block comment 1');
    expect(beforePositionedComment!.comments[1]).toBe('block comment 2');
    expect(beforePositionedComment!.comments[2]).toBe('line comment 3');
    expect(beforePositionedComment!.comments[3]).toBe('line comment 4');
});

test('sufix comment', () => {
    // Arrange
    const tokenizer = new SqlTokenizer(`
   'test'
    /*    
    block comment 1
    block comment 2    
    */
   -- line comment 3
   -- line comment 4
    `);

    // Act
    const lexemes = tokenizer.readLexmes();

    // Assert
    expect(lexemes.length).toBe(1);
    // Check positioned comments for suffix (after) comments
    expect(lexemes[0].positionedComments).toBeDefined();
    const afterPositionedComment = lexemes[0].positionedComments?.find(pc => pc.position === 'after');
    expect(afterPositionedComment).toBeDefined();
    expect(afterPositionedComment!.comments[0]).toBe('block comment 1');
    expect(afterPositionedComment!.comments[1]).toBe('block comment 2');
    expect(afterPositionedComment!.comments[2]).toBe('line comment 3');
    expect(afterPositionedComment!.comments[3]).toBe('line comment 4');
});

test('Empty lines in comments are removed', () => {
    // Arrange
    const tokenizer = new SqlTokenizer(`
    /*   

    block comment 1
    block comment 2

    */
   --
   -- line comment 3
   -- line comment 4
   --
   'test'
    `);

    // Act
    const lexemes = tokenizer.readLexmes();

    // Assert
    expect(lexemes.length).toBe(1);
    // Check positioned comments
    expect(lexemes[0].positionedComments).toBeDefined();
    const beforePositionedComment = lexemes[0].positionedComments?.find(pc => pc.position === 'before');
    expect(beforePositionedComment).toBeDefined();
    expect(beforePositionedComment!.comments.length).toBe(4);
    expect(beforePositionedComment!.comments[0]).toBe('block comment 1');
    expect(beforePositionedComment!.comments[1]).toBe('block comment 2');
    expect(beforePositionedComment!.comments[2]).toBe('line comment 3');
    expect(beforePositionedComment!.comments[3]).toBe('line comment 4');
});

test('Empty lines within block comments are not removed', () => {
    // Arrange
    const tokenizer = new SqlTokenizer(`
    /*   

    block comment 1

    block comment 2

    */
   --
   -- line comment 3
   -- line comment 4
   --
   'test'
    `);

    // Act
    const lexemes = tokenizer.readLexmes();

    // Assert
    expect(lexemes.length).toBe(1);
    // Check positioned comments
    expect(lexemes[0].positionedComments).toBeDefined();
    const beforePositionedComment = lexemes[0].positionedComments?.find(pc => pc.position === 'before');
    expect(beforePositionedComment).toBeDefined();
    expect(beforePositionedComment!.comments.length).toBe(5);
    expect(beforePositionedComment!.comments[0]).toBe('block comment 1');
    expect(beforePositionedComment!.comments[1]).toBe('');
    expect(beforePositionedComment!.comments[2]).toBe('block comment 2');
    expect(beforePositionedComment!.comments[3]).toBe('line comment 3');
    expect(beforePositionedComment!.comments[4]).toBe('line comment 4');
});

test('hint clause(not comment)', () => {
    // Arrange
    const tokenizer = new SqlTokenizer(`
   /*+ hint comment */
   'test'
    `);

    // Act
    const lexemes = tokenizer.readLexmes();

    // Assert
    expect(lexemes.length).toBe(2);
    expect(lexemes[0].comments).toBeNull();
    expect(lexemes[0].value).toBe('/*+ hint comment */');
});

test('Realistic example', () => {
    // Arrange
    const tokenizer = new SqlTokenizer(`
    FLOOR(price * 1.1) -- Calculate total price (including tax) and round down
    `);

    // Act
    const lexemes = tokenizer.readLexmes();

    // Assert
    expect(lexemes.length).toBe(6);
    // Check positioned comments for the last lexeme (should have after comment)
    expect(lexemes[5].positionedComments).toBeDefined();
    const afterPositionedComment = lexemes[5].positionedComments?.find(pc => pc.position === 'after');
    expect(afterPositionedComment).toBeDefined();
    expect(afterPositionedComment!.comments[0]).toBe('Calculate total price (including tax) and round down');
});

test('unterminated block comment does not hang tokenizer', () => {
    const tokenizer = new SqlTokenizer('select /* ');
    const lexemes = tokenizer.readLexmes();

    expect(lexemes.map(lex => lex.value)).toEqual(['select']);
});

test('unterminated escaped identifier throws meaningful error', () => {
    const tokenizer = new SqlTokenizer('select "unterminated');
    expect(() => tokenizer.readLexmes()).toThrow(/Closing delimiter is not found/);
});

test('readWhiteSpaceAndComment consumes unterminated block comment', () => {
    const sql = '/* partial comment';
    const result = StringUtils.readWhiteSpaceAndComment(sql, 0);

    expect(result.position).toBe(sql.length);
    expect(result.lines).toEqual(['partial comment']);
});
