import { TokenType } from "../src/enums/tokenType";
import { SqlTokenizer } from "../src/sqlTokenizer";

test('skip white space', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('  1  ');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].value).toBe('1');
});

