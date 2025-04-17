import { expect, test } from 'vitest';
import { Formatter } from '../../src/transformers/Formatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';

const formatter = new Formatter();

test('should add a CTE with appendWithRaw', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parseFromText('SELECT id FROM users') as SimpleSelectQuery;

    // Act
    baseQuery.appendWithRaw('SELECT id FROM users WHERE status = \'active\'', 'active_users');
    const sql = formatter.visit(baseQuery);

    // Assert
    expect(sql).toEqual('with "active_users" as (select "id" from "users" where "status" = \'active\') select "id" from "users"');
});

test('should add multiple CTEs with appendWithRaw', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parseFromText('SELECT id FROM result') as SimpleSelectQuery;

    // Act
    baseQuery.appendWithRaw('SELECT id FROM t1', 'cte1');
    baseQuery.appendWithRaw('SELECT id FROM t2', 'cte2');
    const sql = formatter.visit(baseQuery);

    // Assert
    expect(sql).toEqual('with "cte1" as (select "id" from "t1"), "cte2" as (select "id" from "t2") select "id" from "result"');
});

test('should add CTE and WHERE together', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parseFromText('SELECT id FROM users') as SimpleSelectQuery;

    // Act
    baseQuery.appendWithRaw('SELECT id FROM users WHERE status = \'active\'', 'active_users');
    baseQuery.appendWhereRaw('id > 10');
    const sql = formatter.visit(baseQuery);

    // Assert
    expect(sql).toEqual('with "active_users" as (select "id" from "users" where "status" = \'active\') select "id" from "users" where "id" > 10');
});

test('should add a recursive CTE with appendWithRaw (auto-detect)', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parseFromText('SELECT id FROM employees_path') as SimpleSelectQuery;

    // Act
    baseQuery.appendWithRaw(`with employees_path as (
        SELECT id, name, CAST(id AS TEXT) as path 
        FROM employees 
        WHERE manager_id IS NULL
        UNION ALL
        SELECT e.id, e.name, ep.path || '->' || CAST(e.id AS TEXT)
        FROM employees e 
        JOIN employees_path ep ON e.manager_id = ep.id
    )select * from employees_path`, 'employees_path_cte');
    const sql = formatter.visit(baseQuery);

    // Assert
    expect(sql).toEqual(
        'with recursive "employees_path" as (select "id", "name", cast("id" as TEXT) as "path" from "employees" where "manager_id" is null union all select "e"."id", "e"."name", "ep"."path" || \'->\' || cast("e"."id" as TEXT) from "employees" as "e" join "employees_path" as "ep" on "e"."manager_id" = "ep"."id"), "employees_path_cte" as (select * from "employees_path") select "id" from "employees_path"'
    );
});

test('should add a recursive CTE with appendWithRaw (auto-detect)2', () => {
    // Arrange
    const baseQuery = SelectQueryParser.parseFromText('SELECT id FROM employees_path') as SimpleSelectQuery;

    // Act
    baseQuery.appendWithRaw(`
        SELECT id, name, CAST(id AS TEXT) as path 
        FROM employees 
        WHERE manager_id IS NULL
        UNION ALL
        SELECT e.id, e.name, ep.path || '->' || CAST(e.id AS TEXT)
        FROM employees e 
        JOIN employees_path ep ON e.manager_id = ep.id
    `, 'employees_path');
    const sql = formatter.visit(baseQuery);

    // Assert
    expect(sql).toEqual(
        'with recursive "employees_path" as (select "id", "name", cast("id" as TEXT) as "path" from "employees" where "manager_id" is null union all select "e"."id", "e"."name", "ep"."path" || \'->\' || cast("e"."id" as TEXT) from "employees" as "e" join "employees_path" as "ep" on "e"."manager_id" = "ep"."id") select "id" from "employees_path"'
    );
});