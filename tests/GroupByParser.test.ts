import { describe, expect, test } from 'vitest';
import { Formatter } from "../src/models/Formatter";
import { GroupByClauseParser } from "../src/parsers/GroupByParser";

const formatter = new Formatter();

test('simple group by', () => {
    // Arrange
    const text = `group by id`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by "id"`);
});

test('group by multiple columns', () => {
    // Arrange
    const text = `group by department_id, job_id`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by "department_id", "job_id"`);
});

test('group by with expression', () => {
    // Arrange
    const text = `group by extract(year from hire_date)`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by extract(year from "hire_date")`);
});

test('group by with function', () => {
    // Arrange
    const text = `group by substr(last_name, 1, 3)`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by substr("last_name", 1, 3)`);
});

test('group by with case expression', () => {
    // Arrange
    const text = `group by case when salary > 10000 then 'High' else 'Low' end`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by case when "salary" > 10000 then 'High' else 'Low' end`);
});

test('group by with multiple expressions', () => {
    // Arrange
    const text = `group by department_id, extract(year from hire_date), job_id`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by "department_id", extract(year from "hire_date"), "job_id"`);
});

test('group by with table qualified column', () => {
    // Arrange
    const text = `group by employees.department_id`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by "employees"."department_id"`);
});

test('group by with grouping set', () => {
    // Arrange
    const text = `group by grouping sets ((department_id), (job_id), (department_id, job_id))`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by grouping sets(("department_id"), ("job_id"), ("department_id", "job_id"))`);
});

test('group by with cube', () => {
    // Arrange
    const text = `group by cube (department_id, job_id)`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by cube("department_id", "job_id")`);
});

test('group by with rollup', () => {
    // Arrange
    const text = `group by rollup (department_id, job_id)`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by rollup("department_id", "job_id")`);
});

test('group by with mix of columns and aggregations', () => {
    // Arrange
    const text = `group by department_id, rollup(job_id, manager_id)`;

    // Act
    const clause = GroupByClauseParser.parseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`group by "department_id", rollup("job_id", "manager_id")`);
});