import { describe, test, expect } from 'vitest';
import { BinarySelectQuery, SelectQuery, SimpleSelectQuery } from '../../src/models/SelectQuery';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/visitors/Formatter';

describe('SelectQuery Binary Operations', () => {
    const formatter = new Formatter();

    test('toUnion creates BinarySelectQuery with UNION operator', () => {
        // Arrange
        const left = SelectQueryParser.parseFromText("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parseFromText("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        const unionQuery = left.toUnion(right);

        // Assert
        expect(unionQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(unionQuery)).toBe('select "id", "value" from "left" union select "id", "value" from "right"');
    });

    test('toUnionAll creates BinarySelectQuery with UNION ALL operator', () => {
        // Arrange
        const left = SelectQueryParser.parseFromText("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parseFromText("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        const unionAllQuery = left.toUnionAll(right);

        // Assert
        expect(unionAllQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(unionAllQuery)).toBe('select "id", "value" from "left" union all select "id", "value" from "right"');
    });

    test('toIntersect creates BinarySelectQuery with INTERSECT operator', () => {
        // Arrange
        const left = SelectQueryParser.parseFromText("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parseFromText("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        const intersectQuery = left.toIntersect(right);

        // Assert
        expect(intersectQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(intersectQuery)).toBe('select "id", "value" from "left" intersect select "id", "value" from "right"');
    });

    test('toIntersectAll creates BinarySelectQuery with INTERSECT ALL operator', () => {
        // Arrange
        const left = SelectQueryParser.parseFromText("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parseFromText("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        const intersectAllQuery = left.toIntersectAll(right);

        // Assert
        expect(intersectAllQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(intersectAllQuery)).toBe('select "id", "value" from "left" intersect all select "id", "value" from "right"');
    });

    test('toExcept creates BinarySelectQuery with EXCEPT operator', () => {
        // Arrange
        const left = SelectQueryParser.parseFromText("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parseFromText("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        const exceptQuery = left.toExcept(right);

        // Assert
        expect(exceptQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(exceptQuery)).toBe('select "id", "value" from "left" except select "id", "value" from "right"');
    });

    test('toExceptAll creates BinarySelectQuery with EXCEPT ALL operator', () => {
        // Arrange
        const left = SelectQueryParser.parseFromText("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parseFromText("SELECT id, value FROM right") as SimpleSelectQuery;

        // Act
        const exceptAllQuery = left.toExceptAll(right);

        // Assert
        expect(exceptAllQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(exceptAllQuery)).toBe('select "id", "value" from "left" except all select "id", "value" from "right"');
    });

    test('toBinaryQuery creates BinarySelectQuery with custom operator', () => {
        // Arrange
        const left = SelectQueryParser.parseFromText("SELECT id, value FROM left") as SimpleSelectQuery;
        const right = SelectQueryParser.parseFromText("SELECT id, value FROM right") as SimpleSelectQuery;
        const customOperator = 'custom operator';

        // Act
        const customQuery = left.toBinaryQuery(customOperator, right);

        // Assert
        expect(customQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(customQuery)).toBe('select "id", "value" from "left" custom operator select "id", "value" from "right"');
    });

    test('appendUnion adds a query with UNION operator to existing BinarySelectQuery', () => {
        // Arrange - Create with actual queries
        const query1 = SelectQueryParser.parseFromText('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parseFromText('SELECT id FROM admins') as SimpleSelectQuery;
        const query3 = SelectQueryParser.parseFromText('SELECT id FROM guests') as SimpleSelectQuery;

        // Act - Create a binary query and append another query
        const binaryQuery = query1.toUnion(query2);
        const resultQuery = binaryQuery.appendUnion(query3);

        // Assert
        expect(resultQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(resultQuery)).toBe('select "id" from "users" union select "id" from "admins" union select "id" from "guests"');
    });

    test('complex query chain works correctly', () => {
        // Arrange - Use actual queries
        const query1 = SelectQueryParser.parseFromText('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parseFromText('SELECT id FROM admins') as SimpleSelectQuery;
        const query3 = SelectQueryParser.parseFromText('SELECT id FROM guests') as SimpleSelectQuery;
        const query4 = SelectQueryParser.parseFromText('SELECT id FROM managers') as SimpleSelectQuery;

        // Act - Chain multiple operations
        const result = query1
            .toUnion(query2)
            .appendIntersect(query3)
            .appendExcept(query4);

        // Assert - Check the result as SQL text
        expect(result).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(result)).toBe('select "id" from "users" union select "id" from "admins" intersect select "id" from "guests" except select "id" from "managers"');
    });

    test('appendSelectQuery allows custom operator', () => {
        // Arrange - Use actual queries
        const query1 = SelectQueryParser.parseFromText('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parseFromText('SELECT id FROM admins') as SimpleSelectQuery;
        const binaryQuery = query1.toUnion(query2);
        const query3 = SelectQueryParser.parseFromText('SELECT id FROM managers');
        const customOperator = 'custom operator';

        // Act - Add a query with custom operator
        const result = binaryQuery.appendSelectQuery(customOperator, query3);

        // Assert - Check the result as SQL text
        expect(result).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(result)).toBe('select "id" from "users" union select "id" from "admins" custom operator select "id" from "managers"');
    });

    test('BinaryQuery can append another BinaryQuery', () => {
        // Arrange - Create two BinaryQuery instances
        const query1 = SelectQueryParser.parseFromText('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parseFromText('SELECT id FROM admins') as SimpleSelectQuery;
        const leftBinary = query1.toUnion(query2);  // (users UNION admins)

        const query3 = SelectQueryParser.parseFromText('SELECT id FROM guests') as SimpleSelectQuery;
        const query4 = SelectQueryParser.parseFromText('SELECT id FROM managers') as SimpleSelectQuery;
        const rightBinary = query3.toIntersect(query4);  // (guests INTERSECT managers)

        // Act - Add a BinaryQuery using appendSelectQuery
        const combinedQuery = leftBinary.appendSelectQuery('except', rightBinary);  // (users UNION admins) EXCEPT (guests INTERSECT managers)

        // Assert - Check the result as SQL text
        expect(combinedQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(combinedQuery)).toBe('select "id" from "users" union select "id" from "admins" except select "id" from "guests" intersect select "id" from "managers"');
    });

    test('toUnion works with queries containing WITH clause', () => {
        // Arrange - Create queries with WITH clauses
        const leftWithQuery = SelectQueryParser.parseFromText(`
            WITH active_users AS (
                SELECT id, name FROM users WHERE active = true
            )
            SELECT id, name FROM active_users
        `) as SimpleSelectQuery;

        const rightWithQuery = SelectQueryParser.parseFromText(`
            WITH inactive_users AS (
                SELECT id, name FROM users WHERE active = false
            )
            SELECT id, name FROM inactive_users
        `) as SimpleSelectQuery;

        // Act - Union two queries with WITH clauses
        const unionQuery = leftWithQuery.toUnion(rightWithQuery);

        // Assert
        expect(unionQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(unionQuery)).toBe('with "active_users" as (select "id", "name" from "users" where "active" = true) select "id", "name" from "active_users" union with "inactive_users" as (select "id", "name" from "users" where "active" = false) select "id", "name" from "inactive_users"');
    });

    test('appendUnion works with queries containing WITH clause', () => {
        // Arrange - Create existing binary query and a WITH clause query to append
        const query1 = SelectQueryParser.parseFromText('SELECT id, name FROM staff') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parseFromText('SELECT id, name FROM contractors') as SimpleSelectQuery;
        const binaryQuery = query1.toUnion(query2);

        const withQuery = SelectQueryParser.parseFromText(`
            WITH vip_customers AS (
                SELECT id, name FROM customers WHERE vip = true
            )
            SELECT id, name FROM vip_customers
        `);

        // Act - Append a query with WITH clause using appendUnion
        const resultQuery = binaryQuery.appendUnion(withQuery);

        // Assert
        expect(resultQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(resultQuery)).toBe('with "vip_customers" as (select "id", "name" from "customers" where "vip" = true) select "id", "name" from "staff" union select "id", "name" from "contractors" union select "id", "name" from "vip_customers"');
    });
});
