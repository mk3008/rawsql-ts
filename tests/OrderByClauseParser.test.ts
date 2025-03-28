import { describe, expect, test } from 'vitest';
import { DefaultFormatter } from "../src/models/DefaultFormatter";
import { OrderByClauseParser } from "../src/parsers/OrderByClauseParser";
import { SortDirection, NullsSortDirection } from "../src/models/Clause";

const formatter = new DefaultFormatter();

test('simple order by', () => {
    // Arrange
    const text = `order by id`;

    // Act
    const clause = OrderByClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`order by "id"`);
});

test('multiple columns', () => {
    // Arrange
    const text = `order by id, name, created_at`;

    // Act
    const clause = OrderByClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`order by "id", "name", "created_at"`);
});

test('with asc/desc', () => {
    // Arrange
    const text = `order by id asc, name desc`;

    // Act
    const clause = OrderByClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`order by "id", "name" desc`);
});

test('with qualified column', () => {
    // Arrange
    const text = `order by a.id, b.name desc`;

    // Act
    const clause = OrderByClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`order by "a"."id", "b"."name" desc`);
});

test('with nulls first/last', () => {
    // Arrange
    const text = `order by id nulls first, name desc nulls last`;

    // Act
    const clause = OrderByClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`order by "id" nulls first, "name" desc nulls last`);
});

test('with expression', () => {
    // Arrange
    const text = `order by price * quantity desc`;

    // Act
    const clause = OrderByClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`order by "price" * "quantity" desc`);
});

test('with function', () => {
    // Arrange
    const text = `order by lower(name), max(price) desc`;

    // Act
    const clause = OrderByClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`order by lower("name"), max("price") desc`);
});
