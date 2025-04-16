import { describe, test, expect } from 'vitest';
import { Formatter } from "../../src/transformers/Formatter";
import { WhereClauseParser } from "../../src/parsers/WhereClauseParser";

const formatter = new Formatter();

test('simple where', () => {
    // Arrange
    const text = `where id = 1`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where "id" = 1`);
});

test('with and operator', () => {
    // Arrange
    const text = `where id = 1 and name = 'test'`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where "id" = 1 and "name" = 'test'`);
});

test('with or operator', () => {
    // Arrange
    const text = `where id = 1 or name = 'test'`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where "id" = 1 or "name" = 'test'`);
});

test('with comparison operators', () => {
    // Arrange
    const text = `where id > 1 and price < 100 and quantity >= 5 and discount <= 0.1`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where "id" > 1 and "price" < 100 and "quantity" >= 5 and "discount" <= 0.1`);
});

test('with in operator', () => {
    // Arrange
    const text = `where status in ('active', 'pending')`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where "status" in ('active', 'pending')`);
});

test('with not in operator', () => {
    // Arrange
    const text = `where status not in ('deleted', 'inactive')`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where "status" not in ('deleted', 'inactive')`);
});

test('with between operator', () => {
    // Arrange
    const text = `where price between 10 and 100`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where "price" between 10 and 100`);
});

test('with is null', () => {
    // Arrange
    const text = `where deleted_at is null`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where "deleted_at" is null`);
});

test('with is not null', () => {
    // Arrange
    const text = `where created_at is not null`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where "created_at" is not null`);
});

test('with like operator', () => {
    // Arrange
    const text = `where name like '%test%'`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where "name" like '%test%'`);
});

test('with nested conditions', () => {
    // Arrange
    const text = `where (id = 1 or id = 2) and (status = 'active' or status = 'pending')`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where ("id" = 1 or "id" = 2) and ("status" = 'active' or "status" = 'pending')`);
});

test('with function', () => {
    // Arrange
    const text = `where lower(name) = 'test' and date_part('year', created_at) = 2023`;

    // Act
    const clause = WhereClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`where lower("name") = 'test' and date_part('year', "created_at") = 2023`);
});
