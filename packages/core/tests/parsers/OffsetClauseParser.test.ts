import { describe, test, expect } from 'vitest';
import { Formatter } from "../../src/transformers/Formatter";
import { OffsetClauseParser } from "../../src/parsers/OffsetClauseParser";

const formatter = new Formatter();

test('simple offset', () => {
    // Arrange
    const text = `offset 10`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset 10`);
});

test('offset with variable - colon syntax', () => {
    // Arrange
    const text = `offset :offset_count`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset :offset_count`);
});

test('offset with variable - question mark syntax', () => {
    // Arrange
    const text = `offset ?`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset :`);
});

test('offset with variable - at symbol syntax', () => {
    // Arrange
    const text = `offset @offset`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset :offset`);
});

test('offset with arithmetic expression', () => {
    // Arrange
    const text = `offset 5 * 2`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset 5 * 2`);
});

test('offset with parenthesized expression', () => {
    // Arrange
    const text = `offset (5 + 5)`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset (5 + 5)`);
});

test('offset with complex expression', () => {
    // Arrange
    const text = `offset (10 * 2) + 5`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset (10 * 2) + 5`);
});

test('offset with row keyword', () => {
    // Arrange
    const text = `offset 10 row`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset 10`);
});

test('offset with rows keyword', () => {
    // Arrange
    const text = `offset 20 rows`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset 20`);
});

test('offset with expression and row keyword', () => {
    // Arrange
    const text = `offset 5 * 3 row`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset 5 * 3`);
});

test('offset with variable and rows keyword', () => {
    // Arrange
    const text = `offset :count rows`;

    // Act
    const clause = OffsetClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`offset :count`);
});

test('error on invalid syntax - missing offset value', () => {
    // Arrange
    const text = `offset`;

    // Act & Assert
    expect(() => OffsetClauseParser.parse(text)).toThrow();
});

test('error on invalid syntax - missing OFFSET keyword', () => {
    // Arrange
    const text = `10`;

    // Act & Assert
    expect(() => OffsetClauseParser.parse(text)).toThrow();
});

test('error on invalid syntax - unexpected trailing tokens', () => {
    // Arrange
    const text = `offset 10 limit`;

    // Act & Assert
    expect(() => OffsetClauseParser.parse(text)).toThrow();
});

test('error on invalid syntax - unexpected token after value', () => {
    // Arrange
    const text = `offset 10 invalid`;

    // Act & Assert
    expect(() => OffsetClauseParser.parse(text)).toThrow();
});

test('error on invalid syntax - wrong keyword at start', () => {
    // Arrange
    const text = `limit 10`;

    // Act & Assert
    expect(() => OffsetClauseParser.parse(text)).toThrow();
});