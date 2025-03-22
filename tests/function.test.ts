import { TokenType } from "../src/models/Lexeme";
import { SqlTokenizer } from "../src/parsers/sqlTokenizer";

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