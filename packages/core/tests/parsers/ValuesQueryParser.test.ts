import { describe, expect, test } from 'vitest';
import { performance } from 'node:perf_hooks';
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

    const expectedSQL = `select "t".* from (values (1)) as "t"("val")`;
    // Assert
    expect(formattedSQL).toBe(expectedSQL);
});

test('values clause preserves inline comments', () => {
    const sql = `--c1
values
--c2
(1, 'Alice'),
(2, 'Bob')
--c3`;

    const clause = ValuesQueryParser.parse(sql);

    expect(clause.headerComments).toEqual(['c1']);

    const firstTuple = clause.tuples[0];
    const beforeComments = firstTuple.getPositionedComments('before');
    expect(beforeComments).toContain('c2');

    const lastTuple = clause.tuples[clause.tuples.length - 1];
    const afterComments = lastTuple.getPositionedComments('after');
    expect(afterComments).toContain('c3');
});

test('values clause with massive row count parses within time budget', () => {
    // Generate a large VALUES clause to simulate stress conditions.
    const rows = Array.from({ length: 20000 }, (_, index) => `(${index}, 'value_${index}')`);
    const sql = `values ${rows.join(', ')}`;

    // Measure parsing latency so the regression stays detectable.
    const start = performance.now();
    const clause = ValuesQueryParser.parse(sql);
    const durationMs = performance.now() - start;

    expect(clause.tuples.length).toBe(20000);
    expect(durationMs).toBeLessThan(2000);
});

