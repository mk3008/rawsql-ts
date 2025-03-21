import { ValueParser } from "../src/parsers/ValueParser";
import { SqlTokenizer } from "../src/sqlTokenizer";
import { DefaultFormatter } from "../src/models/DefaultFormatter";

describe('ValueParser', () => {
    const parseFromText = (text: string) => {
        const tokenizer = new SqlTokenizer(text);
        const lexemes = tokenizer.readLexmes();
        const result = ValueParser.Parse(lexemes, 0);
        const formatter = new DefaultFormatter();
        return formatter.visit(result.value);
    };

    const parse = (text: string) => {
        const tokenizer = new SqlTokenizer(text);
        const lexemes = tokenizer.readLexmes();
        return ValueParser.Parse(lexemes, 0);
    };

    test('ColumnReference', () => {
        // Arrange
        const text = 'a.id';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"a"."id"');
    });

    test('LiteralValue - Numeric', () => {
        // Arrange
        const text = '123';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('123');
    });

    test('LiteralValue - String', () => {
        // Arrange
        const text = "'テスト文字列'";

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe("'テスト文字列'");
    });

    test('BinaryExpression - Arithmetic operation', () => {
        // Arrange
        const text = 'a.id + 10';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"a"."id" + 10');
    });

    test('BinaryExpression - Multiple operators', () => {
        // Arrange
        const text = 'price * quantity - discount';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"price" * "quantity" - "discount"');
    });

    test('UnaryExpression - NOT operator', () => {
        // Arrange
        const text = 'NOT is_active';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('NOT "is_active"');
    });

    test('ParenExpression - Expression enclosed in parentheses', () => {
        // Arrange
        const text = '(a + b) * c';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('("a" + "b") * "c"');
    });

    test('FunctionCall - Single argument', () => {
        // Arrange
        const text = 'COUNT(id)';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('COUNT("id")');
    });

    test('FunctionCall - Multiple arguments', () => {
        // Arrange
        const text = 'SUBSTRING(name, 1, 3)';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('SUBSTRING("name", 1, 3)');
    });

    test('ParameterExpression - Parameter', () => {
        // Arrange
        const text = '@userId';

        // Act
        const sql = parseFromText(text);

        // Assert
        // The default formatter is for Postgres, so it outputs `:userId`
        // This may change in the future
        expect(sql).toBe(':userId');
    });

    test('ArrayExpression - Array', () => {
        // Arrange
        const text = 'ARRAY[1, 2, 3]';

        // Act
        const sql = parseFromText(text);

        // Assert
        // By default, command tokens are output in lowercase
        expect(sql).toBe('array[1, 2, 3]');
    });

    test('CASE - Simple CASE expression', () => {
        // Arrange
        const text = "CASE age WHEN 18 THEN 'young' WHEN 65 THEN 'senior' ELSE 'adult' END";

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe("case \"age\" when 18 then 'young' when 65 then 'senior' else 'adult' end");
    });

    test('CASE WHEN - Conditional branching', () => {
        // Arrange
        const text = "CASE WHEN age > 18 THEN 'adult' ELSE 'minor' END";

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe("case when \"age\" > 18 then 'adult' else 'minor' end");
    });

    test('BETWEEN - Range specification', () => {
        // Arrange
        const text = 'age BETWEEN 20 AND 30';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"age" BETWEEN 20 AND 30');
    });

    test('Complex expression - combination of multiple elements', () => {
        // Arrange
        const text = 'CASE WHEN a.status = 1 THEN upper(a.name) ELSE a.code || \'-\' || @suffix END';

        // Act
        const sql = parseFromText(text);

        // Assert
        // NOTE: In the default formatter, commands are converted to lowercase
        // NOTE: In the default formatter, parameter symbols are converted to ':'
        expect(sql).toBe('case when "a"."status" = 1 then upper("a"."name") else "a"."code" || \'-\' || :suffix end');
    });

    test('Logical operators - AND/OR', () => {
        // Arrange
        const text = 'a.flag = true AND (b.value > 10 OR c.status != 0)';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"a"."flag" = true AND ("b"."value" > 10 OR "c"."status" != 0)');
    });

    test('IN operator', () => {
        // Arrange
        const text = 'category_id IN (1, 2, 3)';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"category_id" IN (1, 2, 3)');
    });
});
