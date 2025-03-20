import { ValueParser } from "../src/parsers/ValueParser";

test('ColumnReference', () => {
    // Arrange
    const text = 'a.id';

    // Act
    const sqlComponent = ValueParser.ParseFromText(text);
    const sql = sqlComponent.toString();

    // Assert
    expect(sql).toBe('"a"."id"');
});
