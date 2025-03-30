import { describe, expect, test } from 'vitest';
import { DefaultFormatter } from "../src/models/DefaultFormatter";
import { LimitOffsetParser } from "../src/parsers/LimitOffsetParser";

const formatter = new DefaultFormatter();

test('simple limit', () => {
    // Arrange
    const text = `limit 10`;

    // Act
    const clause = LimitOffsetParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`limit 10`);
});

test('limit with offset', () => {
    // Arrange
    const text = `limit 10 offset 5`;

    // Act
    const clause = LimitOffsetParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`limit 10 offset 5`);
});

test('limit with variable', () => {
    // Arrange
    const text = `limit :limit_count`;

    // Act
    const clause = LimitOffsetParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`limit :limit_count`);
});

test('limit with variable and offset', () => {
    // Arrange
    const text = `limit :limit_count offset :offset_count`;

    // Act
    const clause = LimitOffsetParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`limit :limit_count offset :offset_count`);
});

test('limit with expression', () => {
    // Arrange
    const text = `limit 5 * 2`;

    // Act
    const clause = LimitOffsetParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`limit 5 * 2`);
});

test('limit with parenthesized expression', () => {
    // Arrange
    const text = `limit (5 + 5)`;

    // Act
    const clause = LimitOffsetParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`limit (5 + 5)`);
});

test('case insensitive keywords', () => {
    // Arrange
    const text = `LIMIT 10 OFFSET 5`;

    // Act
    const clause = LimitOffsetParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`limit 10 offset 5`);
});

test('error on invalid syntax - missing limit value', () => {
    // Arrange
    const text = `limit`;

    // Act & Assert
    expect(() => LimitOffsetParser.parseFromText(text)).toThrow();
});

test('error on invalid syntax - unexpected token after offset', () => {
    // Arrange
    const text = `limit 10 offset`;

    // Act & Assert
    expect(() => LimitOffsetParser.parseFromText(text)).toThrow();
});