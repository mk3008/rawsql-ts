import { TokenType } from "../src/enums/tokenType";
import { SqlTokenizer } from "../src/sqlTokenizer";

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

// EscapedLiteral tests
test('tokenizes E escaped string literal', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("E'test string'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe("E'test string'");
});

test('tokenizes e escaped string literal (lowercase)', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("e'test string'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe("e'test string'");
});

test('tokenizes X escaped binary literal', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("X'DEADBEEF'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe("X'DEADBEEF'");
});

test('tokenizes B escaped bit string literal', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("B'10101'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe("B'10101'");
});

test('tokenizes U& unicode string literal', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("U&'unicode string'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe("U&'unicode string'");
});

test('tokenizes u& unicode string literal (lowercase)', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("u&'unicode string'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe("u&'unicode string'");
});

test('tokenizes escaped string with escaped quote', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("E'It\\'s a test'");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe("E'It\\'s a test'");
});

test('tokenizes empty escaped string literal', () => {
    // Arrange
    const tokenizer = new SqlTokenizer("E''");

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(1);
    expect(tokens[0].type).toBe(TokenType.Literal);
    expect(tokens[0].value).toBe("E''");
});
