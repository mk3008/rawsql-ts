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

    test('LiteralValue - 数値', () => {
        // Arrange
        const text = '123';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('123');
    });

    test('LiteralValue - 文字列', () => {
        // Arrange
        const text = "'テスト文字列'";

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe("'テスト文字列'");
    });

    test('BinaryExpression - 算術演算', () => {
        // Arrange
        const text = 'a.id + 10';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"a"."id" + 10');
    });

    test('BinaryExpression - 複数の演算子', () => {
        // Arrange
        const text = 'price * quantity - discount';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"price" * "quantity" - "discount"');
    });

    test('UnaryExpression - NOT演算子', () => {
        // Arrange
        const text = 'NOT is_active';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('NOT "is_active"');
    });

    test('ParenExpression - 括弧で囲まれた式', () => {
        // Arrange
        const text = '(a + b) * c';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('("a" + "b") * "c"');
    });

    test('FunctionCall - 単一引数', () => {
        // Arrange
        const text = 'COUNT(id)';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('COUNT("id")');
    });

    test('FunctionCall - 複数引数', () => {
        // Arrange
        const text = 'SUBSTRING(name, 1, 3)';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('SUBSTRING("name", 1, 3)');
    });

    test('ParameterExpression - パラメータ', () => {
        // Arrange
        const text = '@userId';

        // Act
        const sql = parseFromText(text);

        // Assert
        // デフォルトはPostgresのformatterであるため、`:userId`で出力されます
        // これは仕様を変更するかもしれません
        expect(sql).toBe(':userId');
    });

    test('ArrayExpression - 配列', () => {
        // Arrange
        const text = 'ARRAY[1, 2, 3]';

        // Act
        const sql = parseFromText(text);

        // Assert
        // デフォルトではコマンドトークンは小文字で出力されます
        expect(sql).toBe('array[1, 2, 3]');
    });

    test('CASE - 単純なCASE式', () => {
        // Arrange
        const text = "CASE age WHEN 18 THEN 'young' WHEN 65 THEN 'senior' ELSE 'adult' END";

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe("case \"age\" when 18 then 'young' when 65 then 'senior' else 'adult' end");
    });

    test('CASE WHEN - 条件分岐', () => {
        // Arrange
        const text = "CASE WHEN age > 18 THEN 'adult' ELSE 'minor' END";

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe("case when \"age\" > 18 then 'adult' else 'minor' end");
    });

    test('BETWEEN - 範囲指定', () => {
        // Arrange
        const text = 'age BETWEEN 20 AND 30';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"age" BETWEEN 20 AND 30');
    });

    test('複雑な式 - 複数の要素の組み合わせ', () => {
        // Arrange
        const text = 'CASE WHEN a.status = 1 THEN upper(a.name) ELSE a.code || \'-\' || @suffix END';

        // Act
        const sql = parseFromText(text);

        // Assert
        // NOTE: デフォルトフォーマッターではコマンドは小文字になります
        // NOTE: デフォルトフォーマッターでは、パラメータ記号が':'に変換されます
        expect(sql).toBe('case when "a"."status" = 1 then upper("a"."name") else "a"."code" || \'-\' || :suffix end');
    });

    test('論理演算子 - AND/OR', () => {
        // Arrange
        const text = 'a.flag = true AND (b.value > 10 OR c.status != 0)';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"a"."flag" = true AND ("b"."value" > 10 OR "c"."status" != 0)');
    });

    test('IN演算子', () => {
        // Arrange
        const text = 'category_id IN (1, 2, 3)';

        // Act
        const sql = parseFromText(text);

        // Assert
        expect(sql).toBe('"category_id" IN (1, 2, 3)');
    });
});
