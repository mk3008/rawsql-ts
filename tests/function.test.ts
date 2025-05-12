import { describe, expect, test } from 'vitest';
import { TokenType } from "../src/models/Lexeme";
import { SqlTokenizer } from "../src/parsers/SqlTokenizer";
import { OperatorTokenReader } from '../src/tokenReaders/OperatorTokenReader';

test('tokenizes SQL function', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('count(*)');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(4);
    expect(tokens[0].type).toBe(TokenType.Function);
    expect(tokens[0].value).toBe('count');
});

test('tokenizes SQL function with arithmetic', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('count(*) + 1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(6); // count, (, *, ), +, 1
    expect(tokens[0].type).toBe(TokenType.Function);
    expect(tokens[0].value).toBe('count');
    expect(tokens[4].type).toBe(TokenType.Operator);
    expect(tokens[4].value).toBe('+');
});
