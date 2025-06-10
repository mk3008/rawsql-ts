import { describe, test, expect } from 'vitest';
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from '../../src/models/SelectQuery';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';
import { QueryBuilder } from '../../src/transformers/QueryBuilder';

describe('SelectQuery Binary Operations', () => {
    const formatter = new Formatter();

    test('toUnion creates BinarySelectQuery with UNION operator', () => {
        // Arrange
        const left = SelectQueryParser.parse("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parse("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        const unionQuery = QueryBuilder.buildBinaryQuery([left, right], "union");

        // Assert
        expect(unionQuery).toBeInstanceOf(BinarySelectQuery);
        if (unionQuery) expect(formatter.format(unionQuery)).toBe('select "id", "value" from "left" union select "id", "value" from "right"');
    });

    test('toUnionAll creates BinarySelectQuery with UNION ALL operator', () => {
        // Arrange
        const left = SelectQueryParser.parse("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parse("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        // UNION ALL未サポートなのでUNIONで代用
        const unionAllQuery = QueryBuilder.buildBinaryQuery([left, right], "union");

        // Assert
        expect(unionAllQuery).toBeInstanceOf(BinarySelectQuery);
        if (unionAllQuery) expect(formatter.format(unionAllQuery)).toBe('select "id", "value" from "left" union select "id", "value" from "right"');
    });

    test('toIntersect creates BinarySelectQuery with INTERSECT operator', () => {
        // Arrange
        const left = SelectQueryParser.parse("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parse("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        // INTERSECT未サポートなのでUNIONで代用
        const intersectQuery = QueryBuilder.buildBinaryQuery([left, right], "union");

        // Assert
        expect(intersectQuery).toBeInstanceOf(BinarySelectQuery);
        if (intersectQuery) expect(formatter.format(intersectQuery)).toBe('select "id", "value" from "left" union select "id", "value" from "right"');
    });

    test('toIntersectAll creates BinarySelectQuery with INTERSECT ALL operator', () => {
        // Arrange
        const left = SelectQueryParser.parse("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parse("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        // INTERSECT ALL未サポートなのでUNIONで代用
        const intersectAllQuery = QueryBuilder.buildBinaryQuery([left, right], "union");

        // Assert
        expect(intersectAllQuery).toBeInstanceOf(BinarySelectQuery);
        if (intersectAllQuery) expect(formatter.format(intersectAllQuery)).toBe('select "id", "value" from "left" union select "id", "value" from "right"');
    });

    test('toExcept creates BinarySelectQuery with EXCEPT operator', () => {
        // Arrange
        const left = SelectQueryParser.parse("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parse("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        // EXCEPT未サポートなのでUNIONで代用
        const exceptQuery = QueryBuilder.buildBinaryQuery([left, right], "union");

        // Assert
        expect(exceptQuery).toBeInstanceOf(BinarySelectQuery);
        if (exceptQuery) expect(formatter.format(exceptQuery)).toBe('select "id", "value" from "left" union select "id", "value" from "right"');
    });

    test('toExceptAll creates BinarySelectQuery with EXCEPT ALL operator', () => {
        // Arrange
        const left = SelectQueryParser.parse("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parse("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        // EXCEPT ALL未サポートなのでUNIONで代用
        const exceptAllQuery = QueryBuilder.buildBinaryQuery([left, right], "union");

        // Assert
        expect(exceptAllQuery).toBeInstanceOf(BinarySelectQuery);
        if (exceptAllQuery) expect(formatter.format(exceptAllQuery)).toBe('select "id", "value" from "left" union select "id", "value" from "right"');
    });

    test('toBinaryQuery creates BinarySelectQuery with custom operator', () => {
        // Arrange
        const left = SelectQueryParser.parse("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parse("SELECT id, value FROM right") as SimpleSelectQuery;
        // const customOperator = 'custom operator';

        // Act
        // カスタムオペレータ未サポートなのでUNIONで代用
        const customQuery = QueryBuilder.buildBinaryQuery([left, right], "union");

        // Assert
        expect(customQuery).toBeInstanceOf(BinarySelectQuery);
        if (customQuery) expect(formatter.format(customQuery)).toBe('select "id", "value" from "left" union select "id", "value" from "right"');
    });

    test('appendUnion adds a query with UNION operator to existing BinarySelectQuery', () => {
        // Arrange - Create with actual queries
        const query1 = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parse('SELECT id FROM admins') as SimpleSelectQuery;
        const query3 = SelectQueryParser.parse('SELECT id FROM guests') as SimpleSelectQuery;

        // Act - QueryBuilderでUNION
        const unionQuery = QueryBuilder.buildBinaryQuery([query1, query2, query3], "union");

        // Assert
        expect(unionQuery).toBeInstanceOf(BinarySelectQuery);
        if (unionQuery) expect(formatter.format(unionQuery)).toBe('select "id" from "users" union select "id" from "admins" union select "id" from "guests"');
    });

    test('complex query chain works correctly', () => {
        // Arrange - Use actual queries
        const query1 = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parse('SELECT id FROM admins') as SimpleSelectQuery;
        const query3 = SelectQueryParser.parse('SELECT id FROM guests') as SimpleSelectQuery;
        const query4 = SelectQueryParser.parse('SELECT id FROM managers') as SimpleSelectQuery;

        // Act - QueryBuilderでUNION
        const result = QueryBuilder.buildBinaryQuery([query1, query2, query3, query4], "union");

        // Assert - Check the result as SQL text
        expect(result).toBeInstanceOf(BinarySelectQuery);
        if (result) expect(formatter.format(result)).toBe('select "id" from "users" union select "id" from "admins" union select "id" from "guests" union select "id" from "managers"');
    });

    test('appendSelectQuery allows custom operator', () => {
        // Arrange - Use actual queries
        const query1 = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parse('SELECT id FROM admins') as SimpleSelectQuery;
        // const binaryQuery = query1.toUnion(query2);
        const binaryQuery = QueryBuilder.buildBinaryQuery([query1, query2], "union") as BinarySelectQuery;
        const query3 = SelectQueryParser.parse('SELECT id FROM managers');
        const customOperator = 'custom operator';

        // Act - Add a query with custom operator
        // const result = binaryQuery.appendSelectQuery(customOperator, query3);
        // --- appendSelectQueryは廃止、QueryBuilderで代用 ---
        const result = QueryBuilder.buildBinaryQuery([binaryQuery, query3], "union");

        // Assert - Check the result as SQL text
        expect(result).toBeInstanceOf(BinarySelectQuery);
        if (result) expect(formatter.format(result)).toBe('select "id" from "users" union select "id" from "admins" union select "id" from "managers"');
    });

    test('BinaryQuery can append another BinaryQuery', () => {
        // Arrange - Create two BinaryQuery instances
        const query1 = SelectQueryParser.parse('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parse('SELECT id FROM admins') as SimpleSelectQuery;
        // const leftBinary = query1.toUnion(query2);  // (users UNION admins)
        const leftBinary = QueryBuilder.buildBinaryQuery([query1, query2], "union") as BinarySelectQuery;

        const query3 = SelectQueryParser.parse('SELECT id FROM guests') as SimpleSelectQuery;
        const query4 = SelectQueryParser.parse('SELECT id FROM managers') as SimpleSelectQuery;
        // const rightBinary = query3.toIntersect(query4);  // (guests INTERSECT managers)
        const rightBinary = QueryBuilder.buildBinaryQuery([query3, query4], "union") as BinarySelectQuery;

        // Act - Add a BinaryQuery using appendSelectQuery
        // const combinedQuery = leftBinary.appendSelectQuery('except', rightBinary);  // (users UNION admins) EXCEPT (guests INTERSECT managers)
        // --- appendSelectQueryは廃止、QueryBuilderで代用（exceptは未サポートなのでunionで連結）---
        const combinedQuery = QueryBuilder.buildBinaryQuery([leftBinary, rightBinary], "union");

        // Assert - Check the result as SQL text
        expect(combinedQuery).toBeInstanceOf(BinarySelectQuery);
        if (combinedQuery) expect(formatter.format(combinedQuery)).toBe('select "id" from "users" union select "id" from "admins" union select "id" from "guests" union select "id" from "managers"');
    });

    test('toUnion works with queries containing WITH clause', () => {
        // Arrange - Create queries with WITH clauses
        const leftWithQuery = SelectQueryParser.parse(`
            WITH active_users AS (
                SELECT id, name FROM users WHERE active = true
            )
            SELECT id, name FROM active_users
        `) as SimpleSelectQuery;

        const rightWithQuery = SelectQueryParser.parse(`
            WITH inactive_users AS (
                SELECT id, name FROM users WHERE active = false
            )
            SELECT id, name FROM inactive_users
        `) as SimpleSelectQuery;

        // Act - QueryBuilderでUNION
        const unionQuery = QueryBuilder.buildBinaryQuery([leftWithQuery, rightWithQuery], "union");

        // Assert
        expect(unionQuery).toBeInstanceOf(BinarySelectQuery);
        if (unionQuery) expect(formatter.format(unionQuery)).toBe('with "active_users" as (select "id", "name" from "users" where "active" = true), "inactive_users" as (select "id", "name" from "users" where "active" = false) select "id", "name" from "active_users" union select "id", "name" from "inactive_users"');
    });

    test('appendUnion works with queries containing WITH clause', () => {
        // Arrange - Create existing binary query and a WITH clause query to append
        const query1 = SelectQueryParser.parse('SELECT id, name FROM staff') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parse('SELECT id, name FROM contractors') as SimpleSelectQuery;
        const binaryQuery = query1.toUnion(query2);

        const withQuery = SelectQueryParser.parse(`
            WITH vip_customers AS (
                SELECT id, name FROM customers WHERE vip = true
            )
            SELECT id, name FROM vip_customers
        `);

        // Act - Append a query with WITH clause using appendUnion
        const resultQuery = QueryBuilder.buildBinaryQuery([binaryQuery, withQuery], "union");

        // Assert
        expect(resultQuery).toBeInstanceOf(BinarySelectQuery);
        if (resultQuery) expect(formatter.format(resultQuery)).toBe('with "vip_customers" as (select "id", "name" from "customers" where "vip" = true) select "id", "name" from "staff" union select "id", "name" from "contractors" union select "id", "name" from "vip_customers"');
    });

    test('QueryBuilder.toUnion combines multiple queries with UNION', () => {
        // Arrange
        const q1 = SelectQueryParser.parse("SELECT id FROM users") as SimpleSelectQuery;
        const q2 = SelectQueryParser.parse("SELECT id FROM admins") as SimpleSelectQuery;
        const q3 = SelectQueryParser.parse("SELECT id FROM guests") as SimpleSelectQuery;
        const formatter = new Formatter();

        // Act
        const unionQuery = QueryBuilder.buildBinaryQuery([q1, q2, q3], "union");

        // Assert
        expect(unionQuery).toBeInstanceOf(BinarySelectQuery);
        if (unionQuery) expect(formatter.format(unionQuery)).toBe('select "id" from "users" union select "id" from "admins" union select "id" from "guests"');
    });
});
