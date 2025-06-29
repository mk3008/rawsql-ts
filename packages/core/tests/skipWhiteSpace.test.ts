import { describe, expect, test } from 'vitest';
﻿import { SqlTokenizer } from "../src/parsers/SqlTokenizer";

test('skip white space', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('  1  ');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].value).toBe('1');
});

test('skip tab', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('\t1\t');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].value).toBe('1');
});

test('skip new line', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('\n1\n');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].value).toBe('1');
});

test('skip carriage return and new line', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('\r\n1\r\n');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].value).toBe('1');
});
