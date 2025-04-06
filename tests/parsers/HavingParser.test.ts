import { describe, test, expect } from 'vitest';
import { Formatter } from "../../src/visitors/Formatter";
import { HavingClauseParser } from "../../src/parsers/HavingParser";

const formatter = new Formatter();

test('simple having with equality', () => {
    // Arrange
    const text = `having count(*) > 5`;

    // Act
    const clause = HavingClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`having count(*) > 5`);
});

test('having with sum function', () => {
    // Arrange
    const text = `having sum(salary) > 50000`;

    // Act
    const clause = HavingClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`having sum("salary") > 50000`);
});

test('having with avg function and comparison', () => {
    // Arrange
    const text = `having avg(price) >= 100.50`;

    // Act
    const clause = HavingClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`having avg("price") >= 100.5`);
});

test('having with multiple conditions', () => {
    // Arrange
    const text = `having count(*) > 5 and max(salary) < 100000`;

    // Act
    const clause = HavingClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`having count(*) > 5 and max("salary") < 100000`);
});

test('having with complex expression', () => {
    // Arrange
    const text = `having count(distinct product_id) > 3 and sum(quantity * price) > 1000`;

    // Act
    const clause = HavingClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`having count(distinct "product_id") > 3 and sum("quantity" * "price") > 1000`);
});

test('having with or condition', () => {
    // Arrange
    const text = `having min(salary) < 30000 or max(salary) > 150000`;

    // Act
    const clause = HavingClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`having min("salary") < 30000 or max("salary") > 150000`);
});

test('having with nested expressions', () => {
    // Arrange
    const text = `having (count(*) > 10 and sum(amount) > 1000) or avg(price) > 50`;

    // Act
    const clause = HavingClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`having (count(*) > 10 and sum("amount") > 1000) or avg("price") > 50`);
});

test('having with case expression', () => {
    // Arrange
    const text = `having sum(case when status = 'completed' then 1 else 0 end) > 5`;

    // Act
    const clause = HavingClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`having sum(case when "status" = 'completed' then 1 else 0 end) > 5`);
});