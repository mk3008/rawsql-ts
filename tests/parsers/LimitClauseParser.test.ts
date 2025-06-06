import { describe, test, expect } from 'vitest';
import { Formatter } from "../../src/transformers/Formatter";
import { LimitClauseParser } from "../../src/parsers/LimitClauseParser";

const formatter = new Formatter();

test('simple limit', () => {
    // Arrange
    const text = `limit 10`;

    // Act
    const clause = LimitClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`limit 10`);
});

test('limit with variable', () => {
    // Arrange
    const text = `limit :limit_count`;

    // Act
    const clause = LimitClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`limit :limit_count`);
});

test('limit with expression', () => {
    // Arrange
    const text = `limit 5 * 2`;

    // Act
    const clause = LimitClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`limit 5 * 2`);
});

test('limit with parenthesized expression', () => {
    // Arrange
    const text = `limit (5 + 5)`;

    // Act
    const clause = LimitClauseParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`limit (5 + 5)`);
});

test('error on invalid syntax - missing limit value', () => {
    // Arrange
    const text = `limit`;

    // Act & Assert
    expect(() => LimitClauseParser.parse(text)).toThrow();
});

test('error on invalid syntax - unexpected token after offset', () => {
    // Arrange
    const text = `limit 10 offset`;

    // Act & Assert
    expect(() => LimitClauseParser.parse(text)).toThrow();
});