import { TokenType } from "../src/enums/tokenType";
import { SqlTokenizer } from "../src/sqlTokenizer";

test('tokenizes integer number', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('select');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Command);
    expect(tokens[0].value).toBe('select');
});