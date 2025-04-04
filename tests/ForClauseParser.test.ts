import { describe, expect, test } from 'vitest';
import { Formatter } from "../src/models/Formatter";
import { ForClauseParser } from "../src/parsers/ForClauseParser";
import { LockMode } from '../src/models/Clause';

const formatter = new Formatter();

test('for update', () => {
    // Arrange
    const text = `for update`;

    // Act
    const clause = ForClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`for update`);
    expect(clause.lockMode).toBe(LockMode.Update);
});

test('for share', () => {
    // Arrange
    const text = `for share`;

    // Act
    const clause = ForClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`for share`);
    expect(clause.lockMode).toBe(LockMode.Share);
});

test('for key share', () => {
    // Arrange
    const text = `for key share`;

    // Act
    const clause = ForClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`for key share`);
    expect(clause.lockMode).toBe(LockMode.KeyShare);
});

test('for no key update', () => {
    // Arrange
    const text = `for no key update`;

    // Act
    const clause = ForClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`for no key update`);
    expect(clause.lockMode).toBe(LockMode.NokeyUpdate);
});

test('case insensitive keywords', () => {
    // Arrange
    const text = `FOR UPDATE`;

    // Act
    const clause = ForClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`for update`);
    expect(clause.lockMode).toBe(LockMode.Update);
});

test('error on missing lock mode', () => {
    // Arrange
    const text = `for`;

    // Act & Assert
    expect(() => ForClauseParser.parseFromText(text)).toThrow();
});

test('error on invalid lock mode', () => {
    // Arrange
    const text = `for invalid`;

    // Act & Assert
    expect(() => ForClauseParser.parseFromText(text)).toThrow();
});

test('error on unexpected token after lock mode', () => {
    // Arrange
    const text = `for update extra`;

    // Act & Assert
    expect(() => ForClauseParser.parseFromText(text)).toThrow();
});