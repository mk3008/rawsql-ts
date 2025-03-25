import { TokenType } from "../src/models/Lexeme";
import { SqlTokenizer } from "../src/parsers/SqlTokenizer";

test('tokenizes table column', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('a.id');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[0].type).toBe(TokenType.Identifier);
    expect(tokens[0].value).toBe('a');
    expect(tokens[1].type).toBe(TokenType.Dot);
    expect(tokens[1].value).toBe('.');
    expect(tokens[2].type).toBe(TokenType.Identifier);
    expect(tokens[2].value).toBe('id');
});

test('tokenizes escaped identifier', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('`table name`.`column name`');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    // exclude escape character
    expect(tokens.length).toBe(3);
    expect(tokens[0].type).toBe(TokenType.Identifier);
    expect(tokens[0].value).toBe('table name');
    expect(tokens[1].type).toBe(TokenType.Dot);
    expect(tokens[1].value).toBe('.');
    expect(tokens[2].type).toBe(TokenType.Identifier);
    expect(tokens[2].value).toBe('column name');
});

