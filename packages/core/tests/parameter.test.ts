import { describe, expect, test } from 'vitest';
import { TokenType } from "../src/models/Lexeme";
import { SqlTokenizer } from "../src/parsers/SqlTokenizer";

test('tokenizes named parameter in SQLServer', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('@param1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Parameter);
    expect(tokens[0].value).toBe('@param1');
});

test('tokenizes positional parameter in PostgreSQL', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('$1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Parameter);
    expect(tokens[0].value).toBe('$1');
});

test('tokenizes unnamed parameter in MySQL', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('?');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Parameter);
    expect(tokens[0].value).toBe('?');
});

test('tokenizes named parameter with colon prefix in PostgreSQL', () => {
    // Arrange
    const tokenizer = new SqlTokenizer(':param1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Parameter);
    expect(tokens[0].value).toBe(':param1');
});

test('tokenizes parameter with suffix syntax', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('select ${name}');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    // Should tokenize 'select' as identifier/keyword and '${name}' as parameter
    expect(tokens.length).toBe(2);
    expect(tokens[0].value.toLowerCase()).toBe('select');
    expect(tokens[1].type).toBe(TokenType.Parameter);
    expect(tokens[1].value).toBe('${name}');
});
