import { describe, expect, test } from 'vitest';
﻿import { SqlTokenizer } from "../src/parsers/SqlTokenizer";

test('skip line comment', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('--comment\n1--comment');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].value).toBe('1');
});

test('skip block comment', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('/*comment*/1/*comment*/');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].value).toBe('1');
});