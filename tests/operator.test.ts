import { TokenType } from "../src/models/Lexeme";
import { SqlTokenizer } from "../src/parsers/SqlTokenizer";

test('tokenizes addition operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1+1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('+');
});

test('tokenizes multiplication operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1*2');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('*');
});

test('tokenizes division operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1/3');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('/');
});

test('tokenizes modulus operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1%4');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('%');
});

test('tokenizes type convert operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1::text');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('::');
});

test('tokenizes equality operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1==1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('==');
});

test('tokenizes inequality operator !=', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1!=2');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('!=');
});

test('tokenizes inequality operator　<>', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1<>2');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('<>');
});

test('tokenizes less than operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1<2');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('<');
});

test('tokenizes greater than operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1>0');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('>');
});

test('tokenizes less than or equal operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1<=2');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('<=');
});

test('tokenizes greater than or equal operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1>=0');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('>=');
});

test('tokenizes bitwise NOT operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('~1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(2);
    expect(tokens[0].type).toBe(TokenType.Operator);
    expect(tokens[0].value).toBe('~');
});

test('tokenizes array operation operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('array@>1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('@>');
});

test('tokenizes JSON operation operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('json#>1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('#>');
});

test('tokenizes exponentiation/XOR operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('2^3');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('^');
});

test('tokenizes bitwise AND operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1&1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('&');
});

test('tokenizes bitwise OR operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1|1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('|');
});

test('tokenizes "is" operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1 is 1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('is');
});

test('tokenizes "is not" operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1 is not 1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('is not');
});

test('tokenizes "and" operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1 and 1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('and');
});

test('tokenizes "or" operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1 or 1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('or');
});

test('tokenizes "like" operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1 like 1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('like');
});

test('tokenizes "not like" operator', () => {
    // Arrange
    const tokenizer = new SqlTokenizer('1 not like 1');

    // Act
    const tokens = tokenizer.readLexmes();

    // Assert
    expect(tokens.length).toBe(3);
    expect(tokens[1].type).toBe(TokenType.Operator);
    expect(tokens[1].value).toBe('not like');
});