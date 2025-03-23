import { TokenType } from "../src/models/Lexeme";
import { SqlTokenizer } from "../src/parsers/sqlTokenizer";
import { ValueParser } from "../src/parsers/ValueParser";

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
    expect(lexemes[0].comments?.length).toBe(4);
    expect(lexemes[0].comments?.[0]).toBe('block comment 1');
    expect(lexemes[0].comments?.[1]).toBe('block comment 2');
    expect(lexemes[0].comments?.[2]).toBe('line comment 3');
    expect(lexemes[0].comments?.[3]).toBe('line comment 4');
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
    expect(lexemes[0].comments).toBeNull();
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
    expect(lexemes[0].comments?.length).toBe(4);
    expect(lexemes[0].comments?.[0]).toBe('block comment 1');
    expect(lexemes[0].comments?.[1]).toBe('block comment 2');
    expect(lexemes[0].comments?.[2]).toBe('line comment 3');
    expect(lexemes[0].comments?.[3]).toBe('line comment 4');
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
    expect(lexemes[0].comments?.length).toBe(5);
    expect(lexemes[0].comments?.[0]).toBe('block comment 1');
    expect(lexemes[0].comments?.[1]).toBe('');
    expect(lexemes[0].comments?.[2]).toBe('block comment 2');
    expect(lexemes[0].comments?.[3]).toBe('line comment 3');
    expect(lexemes[0].comments?.[4]).toBe('line comment 4');
});