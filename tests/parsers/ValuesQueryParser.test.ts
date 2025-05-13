import { describe, expect, test } from 'vitest';
import { Formatter } from "../../src/transformers/Formatter";
import { ValuesQueryParser } from "../../src/parsers/ValuesQueryParser";
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

const formatter = new Formatter();

test('simple values clause with single tuple', () => {
    // Arrange
    const text = `values (1, 'test', true)`;

    // Act
    const clause = ValuesQueryParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`values (1, 'test', true)`);
});

test('values clause with multiple tuples', () => {
    // Arrange
    const text = `values (1, 'apple', 0.99), (2, 'banana', 0.59), (3, 'orange', 0.79)`;

    // Act
    const clause = ValuesQueryParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`values (1, 'apple', 0.99), (2, 'banana', 0.59), (3, 'orange', 0.79)`);
});

test('values clause with expressions', () => {
    // Arrange
    const text = `values (1 + 2, concat('hello', ' ', 'world'), 5 * 10)`;

    // Act
    const clause = ValuesQueryParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`values (1 + 2, concat('hello', ' ', 'world'), 5 * 10)`);
});

test('values clause with null values', () => {
    // Arrange
    const text = `values (1, null, 'test'), (null, 'value', null)`;

    // Act
    const clause = ValuesQueryParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`values (1, null, 'test'), (null, 'value', null)`);
});

test('values clause with empty tuple', () => {
    // Arrange
    const text = `values ()`;

    // Act
    const clause = ValuesQueryParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`values ()`);
});

test('values clause with nested expressions', () => {
    // Arrange
    const text = `values ((1 + 2) * 3, (select max(id) from users), case when x > 0 then 'positive' else 'negative' end)`;

    // Act
    const clause = ValuesQueryParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`values ((1 + 2) * 3, (select max("id") from "users"), case when "x" > 0 then 'positive' else 'negative' end)`);
});

test('values clause with function calls', () => {
    // Arrange
    const text = `values (now(), upper('text'), random())`;

    // Act
    const clause = ValuesQueryParser.parse(text);
    const sql = formatter.format(clause);

    // Assert
    expect(sql).toEqual(`values (now(), upper('text'), random())`);
});

test('error on missing VALUES keyword', () => {
    // Arrange
    const text = `(1, 2, 3)`;

    // Act & Assert
    expect(() => ValuesQueryParser.parse(text)).toThrow(/Expected 'VALUES' keyword/);
});

test('error on malformed tuple', () => {
    // Arrange
    const text = `values 1, 2, 3`;

    // Act & Assert
    expect(() => ValuesQueryParser.parse(text)).toThrow(/Expected opening parenthesis/);
});

test('error on unclosed tuple', () => {
    // Arrange
    const text = `values (1, 2, 3`;

    // Act & Assert
    expect(() => ValuesQueryParser.parse(text)).toThrow(/Expected closing parenthesis/);
});

test('error on unexpected end after comma', () => {
    // Arrange
    const text = `values (1, 2), `;

    // Act & Assert
    expect(() => ValuesQueryParser.parse(text)).toThrow();
});

test("parses VALUES clause with subquery alias", () => {
    // Arrange
    const sql = `select t.* from (values (1)) t(val)`;

    // Act
    const query = SelectQueryParser.parse(sql);
    const formattedSQL = formatter.format(query);

    // Assert
    expect(formattedSQL).toBe(sql);
});
