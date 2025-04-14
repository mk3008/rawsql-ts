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
        expect(formatter.visit(unionQuery)).toBe('select "left".* from "dual" as "left" union select "right".* from "dual" as "right"');
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
        // Arrange - 実際のクエリを使って作成
        const query1 = SelectQueryParser.parseFromText('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parseFromText('SELECT id FROM admins') as SimpleSelectQuery;
        const query3 = SelectQueryParser.parseFromText('SELECT id FROM guests') as SimpleSelectQuery;

        // Act - バイナリクエリを作成して別のクエリを追加
        const binaryQuery = query1.toUnion(query2);
        const resultQuery = binaryQuery.appendUnion(query3);

        // Assert - SQLテキストで結果を確認
        expect(resultQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(resultQuery)).toBe('select "id" from "users" union select "id" from "admins" union select "id" from "guests"');
    }); test('complex query chain works correctly', () => {
        // Arrange - 実際のクエリを使用
        const query1 = SelectQueryParser.parseFromText('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parseFromText('SELECT id FROM admins') as SimpleSelectQuery;
        const query3 = SelectQueryParser.parseFromText('SELECT id FROM guests') as SimpleSelectQuery;
        const query4 = SelectQueryParser.parseFromText('SELECT id FROM managers') as SimpleSelectQuery;

        // Act - 複数の操作を連鎖させる
        const result = query1
            .toUnion(query2)
            .appendIntersect(query3)
            .appendExcept(query4);

        // Assert - SQLテキストで結果を確認
        expect(result).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(result)).toBe('select "id" from "users" union select "id" from "admins" intersect select "id" from "guests" except select "id" from "managers"');
    });

    test('appendSelectQuery allows custom operator', () => {
        // Arrange - 実際のクエリを使用
        const query1 = SelectQueryParser.parseFromText('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parseFromText('SELECT id FROM admins') as SimpleSelectQuery;
        const binaryQuery = query1.toUnion(query2);
        const query3 = SelectQueryParser.parseFromText('SELECT id FROM managers');
        const customOperator = 'custom operator';

        // Act - カスタムオペレータでクエリを追加
        const result = binaryQuery.appendSelectQuery(customOperator, query3);

        // Assert - SQLテキストで結果を確認
        expect(result).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(result)).toBe('select "id" from "users" union select "id" from "admins" custom operator select "id" from "managers"');
    });

    test('BinaryQuery can append another BinaryQuery', () => {
        // Arrange - 2つのBinaryQueryを作成
        const query1 = SelectQueryParser.parseFromText('SELECT id FROM users') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parseFromText('SELECT id FROM admins') as SimpleSelectQuery;
        const leftBinary = query1.toUnion(query2);  // (users UNION admins)

        const query3 = SelectQueryParser.parseFromText('SELECT id FROM guests') as SimpleSelectQuery;
        const query4 = SelectQueryParser.parseFromText('SELECT id FROM managers') as SimpleSelectQuery;
        const rightBinary = query3.toIntersect(query4);  // (guests INTERSECT managers)

        // Act - appendSelectQueryでBinaryQueryを追加
        const combinedQuery = leftBinary.appendSelectQuery('except', rightBinary);  // (users UNION admins) EXCEPT (guests INTERSECT managers)

        // Assert - SQLテキストで結果を確認
        expect(combinedQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(combinedQuery)).toBe('select "id" from "users" union select "id" from "admins" except select "id" from "guests" intersect select "id" from "managers"');
    });

    test('toUnion works with queries containing WITH clause', () => {
        // Arrange - WITH句を含むクエリを作成
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

        // Act - WITH句を含む2つのクエリをUNION
        const unionQuery = leftWithQuery.(rightWithQuery);

        // Assert
        expect(unionQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(unionQuery)).toBe('with "active_users" as (select "id", "name" from "users" where "active" = true) select "id", "name" from "active_users" union with "inactive_users" as (select "id", "name" from "users" where "active" = false) select "id", "name" from "inactive_users"');
    });

    test('appendUnion works with queries containing WITH clause', () => {
        // Arrange - 既存のバイナリクエリと追加するWITH句クエリを作成
        const query1 = SelectQueryParser.parseFromText('SELECT id, name FROM staff') as SimpleSelectQuery;
        const query2 = SelectQueryParser.parseFromText('SELECT id, name FROM contractors') as SimpleSelectQuery;
        const binaryQuery = query1.toUnion(query2);

        const withQuery = SelectQueryParser.parseFromText(`
            WITH vip_customers AS (
                SELECT id, name FROM customers WHERE vip = true
            )
            SELECT id, name FROM vip_customers
        `);

        // Act - WITH句を含むクエリをappendUnionで追加
        const resultQuery = binaryQuery.appendUnion(withQuery);

        // Assert
        expect(resultQuery).toBeInstanceOf(BinarySelectQuery);
        expect(formatter.visit(resultQuery)).toBe('select "id", "name" from "staff" union select "id", "name" from "contractors" union with "vip_customers" as (select "id", "name" from "customers" where "vip" = true) select "id", "name" from "vip_customers"');
    });
});
