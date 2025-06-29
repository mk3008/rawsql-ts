import { describe, expect, test } from 'vitest';
﻿import { TokenType } from "../src/models/Lexeme";
import { SqlTokenizer } from "../src/parsers/SqlTokenizer";

test('tokenizes string', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("'test string'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe("test string");
});

test('tokenizes integer number', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('123');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('123');
});

test('tokenizes positive number', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('+123');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('123');
});

test('tokenizes decimal number', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('123.456');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('123.456');
});

test('tokenizes number starting with dot', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('.456');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('0.456');
});

test('tokenizes hexadecimal number', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('0x1A3F');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('0x1A3F');
});

test('tokenizes exponential notation', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1.23e+10');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('1.23e+10');
});

test('tokenizes negative integer number', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('-123');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('-123');
});

test('tokenizes negative decimal number', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('-123.456');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('-123.456');
});

test('tokenizes negative number starting with dot', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('-.456');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('-0.456');
});

test('tokenizes negative exponential notation', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('-1.23e+10');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('-1.23e+10');
});

test('tokenizes keyword null', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('null');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('null');
});

test('tokenizes keyword true', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('true');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('true');
});

test('tokenizes keyword false', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('false');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('false');
});

test('tokenizes keyword current_date', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('current_date');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('current_date');
});

test('tokenizes keyword current_time', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('current_time');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('current_time');
});

test('tokenizes keyword current_timestamp', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('current_timestamp');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('current_timestamp');
});

test('tokenizes keyword localtime', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('localtime');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('localtime');
});

test('tokenizes keyword localtimestamp', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('localtimestamp');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('localtimestamp');
});

test('tokenizes keyword unbounded', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('unbounded');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('unbounded');
});

test('tokenizes keyword normalized', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('normalized');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('normalized');
});

test('tokenizes keyword nfc normalized', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('nfc normalized');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('nfc normalized');
});

test('tokenizes keyword nfd normalized', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('nfd normalized');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('nfd normalized');
});

test('tokenizes keyword nfkc normalized', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('nfkc normalized');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('nfkc normalized');
});

test('tokenizes keyword nfkd normalized', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('nfkd normalized');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('nfkd normalized');
});

test('tokenizes keyword nfc', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('nfc');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('nfc');
});

test('tokenizes keyword nfd', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('nfd');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('nfd');
});

test('tokenizes keyword nfkc', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('nfkc');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('nfkc');
});

test('tokenizes keyword nfkd', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('nfkd');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe('nfkd');
});
