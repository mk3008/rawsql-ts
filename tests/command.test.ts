import { TokenType } from "../src/models/Lexeme";
import { SqlTokenizer } from "../src/parsers/SqlTokenizer";

test('tokenizes SQL command', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('select');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Command);
    expect(tokens[0].value).toBe('select');
});
