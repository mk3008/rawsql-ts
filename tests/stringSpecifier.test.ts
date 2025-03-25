import { TokenType } from "../src/models/Lexeme";
import { SqlTokenizer } from "../src/parsers/SqlTokenizer";

// EscapedLiteral tests
test('tokenizes E escaped string literal', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("E'test string'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(2);
    expect(tokens[0].type).toBe(TokenType.StringSpecifier);
    expect(tokens[0].value).toBe("E");
});

test('tokenizes e escaped string literal (lowercase)', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("e'test string'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(2);
    expect(tokens[0].type).toBe(TokenType.StringSpecifier);
    expect(tokens[0].value).toBe("e");
});

test('tokenizes X escaped binary literal', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("X'DEADBEEF'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(2);
    expect(tokens[0].type).toBe(TokenType.StringSpecifier);
    expect(tokens[0].value).toBe("X");
});

test('tokenizes B escaped bit string literal', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("B'10101'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(2);
    expect(tokens[0].type).toBe(TokenType.StringSpecifier);
    expect(tokens[0].value).toBe("B");
});

test('tokenizes U& unicode string literal', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("U&'unicode string'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(2);
    expect(tokens[0].type).toBe(TokenType.StringSpecifier);
    expect(tokens[0].value).toBe("U&");
});

test('tokenizes u& unicode string literal (lowercase)', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("u&'unicode string'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(2);
    expect(tokens[0].type).toBe(TokenType.StringSpecifier);
    expect(tokens[0].value).toBe("u&");
});

test('tokenizes escaped string with escaped quote', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("E'It\\'s a test'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(2);
    expect(tokens[0].type).toBe(TokenType.StringSpecifier);
    expect(tokens[0].value).toBe("E");
});

test('tokenizes empty escaped string literal', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("E''");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(2);
    expect(tokens[0].type).toBe(TokenType.StringSpecifier);
    expect(tokens[0].value).toBe("E");
});
