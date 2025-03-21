import { ValueParser } from "../src/parsers/ValueParser";
import { SqlTokenizer } from "../src/sqlTokenizer";
import { DefaultFormatter } from "../src/models/DefaultFormatter";

describe('ValueParser', () => {
    const formatter = new DefaultFormatter();

    test.each([
        ["ColumnReference", "a.id", '"a"."id"'],
        ["LiteralValue - Numeric", "123", "123"],
        ["LiteralValue - String", "'テスト文字列'", "'テスト文字列'"],
        ["LiteralValue - TRUE", "TRUE", "true"],
        ["LiteralValue - FALSE", "FALSE", "false"],
        ["LiteralValue - NULL", "NULL", "null"],
        ["BinaryExpression - Arithmetic operation", "a.id + 10", '"a"."id" + 10'],
        ["BinaryExpression - Multiple operators", "price * quantity - discount", '"price" * "quantity" - "discount"'],
        ["UnaryExpression - NOT operator", "NOT is_active", 'NOT "is_active"'],
        ["ParenExpression - Expression enclosed in parentheses", "(a + b) * c", '("a" + "b") * "c"'],
        ["FunctionCall - Single argument", "COUNT(id)", 'COUNT("id")'],
        ["FunctionCall - Multiple arguments", "SUBSTRING(name, 1, 3)", 'SUBSTRING("name", 1, 3)'],
        ["ParameterExpression - Parameter", "@userId", ":userId"],
        ["ArrayExpression - Array", "ARRAY[1, 2, 3]", "array[1, 2, 3]"],
        ["CASE - Simple CASE expression", "CASE age WHEN 18 THEN 'young' WHEN 65 THEN 'senior' ELSE 'adult' END", "case \"age\" when 18 then 'young' when 65 then 'senior' else 'adult' end"],
        ["CASE WHEN - Conditional branching", "CASE WHEN age > 18 THEN 'adult' ELSE 'minor' END", "case when \"age\" > 18 then 'adult' else 'minor' end"],
        ["BETWEEN - Range specification", "age BETWEEN 20 AND 30", '"age" BETWEEN 20 AND 30'],
        ["Complex expression - combination of multiple elements", "CASE WHEN a.status = 1 THEN upper(a.name) ELSE a.code || '-' || @suffix END", 'case when "a"."status" = 1 then upper("a"."name") else "a"."code" || \'-\' || :suffix end'],
        ["Logical operators - AND/OR", "a.flag = true AND (b.value > 10 OR c.status != 0)", '"a"."flag" = true AND ("b"."value" > 10 OR "c"."status" != 0)'],
        ["IN operator", "category_id IN (1, 2, 3)", '"category_id" IN (1, 2, 3)'],
        ["IS operator", "a.value IS NULL", '"a"."value" IS null'],
        ["IS DISTINCT FROM operator", "a.value IS DISTINCT FROM b.value", '"a"."value" IS DISTINCT FROM "b"."value"'],
        ["IS NOT DISTINCT FROM operator", "a.value IS NOT DISTINCT FROM b.value", '"a"."value" IS NOT DISTINCT FROM "b"."value"'],
    ])('%s', (_, text, expected) => {
        const value = ValueParser.ParseFromText(text);
        const sql = formatter.visit(value);
        console.log(`text: ${text}\n sql: ${sql}`);
        expect(sql).toBe(expected);
    });
});
