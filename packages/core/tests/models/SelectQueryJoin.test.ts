import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';

const formatter = new Formatter();

describe('SimpleSelectQuery JOIN API', () => {
    test('innerJoin: basic usage', () => {
        // Arrange
        const sql = 'SELECT u.id, u.name FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        query.innerJoinRaw('orders', 'o', ['id']);

        // Act
        const result = formatter.format(query);
        const expected = 'select "u"."id", "u"."name" from "users" as "u" inner join "orders" as "o" on "u"."id" = "o"."id"';

        // Assert
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('leftJoin: multi-column', () => {
        // Arrange
        const sql = 'SELECT u.id, u.name FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        query.leftJoinRaw('orders', 'o', ['id', 'name']);

        // Act
        const result = formatter.format(query);
        const expected = 'select "u"."id", "u"."name" from "users" as "u" left join "orders" as "o" on "u"."id" = "o"."id" and "u"."name" = "o"."name"';

        // Assert
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('rightJoin: schema qualified', () => {
        // Arrange
        const sql = 'SELECT u.id FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        query.rightJoinRaw('public.orders', 'o', ['id']);

        // Act
        const result = formatter.format(query);
        const expected = 'select "u"."id" from "users" as "u" right join "public"."orders" as "o" on "u"."id" = "o"."id"';

        // Assert
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('throws if join column not found', () => {
        // Arrange
        const sql = 'SELECT u.id FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        // Act & Assert
        expect(() => query.innerJoinRaw('orders', 'o', ['not_exist'])).toThrow();
    });

    test('throws if FROM clause is missing', () => {
        // Arrange
        const sql = 'SELECT 1 as id';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        // Act & Assert
        expect(() => query.innerJoinRaw('orders', 'o', ['id'])).toThrow();
    });

    test('innerJoinRaw: can join with a subquery', () => {
        // Arrange
        const subquery = 'SELECT id, name FROM orders WHERE status = \'active\'';
        const sql = 'SELECT u.id, u.name FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        // Act
        query.innerJoinRaw(`(${subquery})`, 'o', ['id']);
        const result = formatter.format(query);

        // Assert
        const expected = 'select "u"."id", "u"."name" from "users" as "u" inner join (select "id", "name" from "orders" where "status" = \'active\') as "o" on "u"."id" = "o"."id"';
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('innerJoinRaw: join with subquery and both queries have WITH clause', () => {
        // Arrange
        const subquery = `WITH sub_orders AS (SELECT id, name FROM orders WHERE status = 'active') SELECT id, name FROM sub_orders`;
        const sql = `WITH sub_users AS (SELECT id, name FROM users WHERE active = true) SELECT u.id, u.name FROM sub_users u`;
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        // Act
        query.innerJoinRaw(`(${subquery})`, 'o', ['id']);
        const result = formatter.format(query);

        // Assert
        const expected = 'with "sub_orders" as (select "id", "name" from "orders" where "status" = \'active\'), "sub_users" as (select "id", "name" from "users" where "active" = true) select "u"."id", "u"."name" from "sub_users" as "u" inner join (select "id", "name" from "sub_orders") as "o" on "u"."id" = "o"."id"';
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('innerJoin: join with subquery using toSource', () => {
        // Arrange
        const subquery = SelectQueryParser.parse('SELECT id, name FROM orders WHERE status = "active"') as SimpleSelectQuery;
        const sql = 'SELECT u.id, u.name FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        // Use toSource to wrap subquery as a source
        query.innerJoin(subquery.toSource('o'), ['id']);

        // Act
        const result = formatter.format(query);

        // Assert
        const expected = 'select "u"."id", "u"."name" from "users" as "u" inner join (select "id", "name" from "orders" where "status" = "active") as "o" on "u"."id" = "o"."id"';
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('innerJoinRaw: single string column', () => {
        const sql = 'SELECT u.id, u.name FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        query.innerJoinRaw('orders', 'o', 'id');
        const result = formatter.format(query);
        const expected = 'select "u"."id", "u"."name" from "users" as "u" inner join "orders" as "o" on "u"."id" = "o"."id"';
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('leftJoinRaw: single string column', () => {
        const sql = 'SELECT u.id, u.name FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        query.leftJoinRaw('orders', 'o', 'id');
        const result = formatter.format(query);
        const expected = 'select "u"."id", "u"."name" from "users" as "u" left join "orders" as "o" on "u"."id" = "o"."id"';
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('rightJoinRaw: single string column', () => {
        // Arrange
        const sql = 'SELECT u.id FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        // Act
        query.rightJoinRaw('public.orders', 'o', 'id');
        const result = formatter.format(query);

        // Assert
        const expected = 'select "u"."id" from "users" as "u" right join "public"."orders" as "o" on "u"."id" = "o"."id"';
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('innerJoin: single string column', () => {
        // Arrange
        const sql = 'SELECT u.id, u.name FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const subquery = SelectQueryParser.parse('SELECT id, name FROM orders') as SimpleSelectQuery;

        // Act
        query.innerJoin(subquery.toSource('o'), 'id');
        const result = formatter.format(query);

        // Assert
        const expected = 'select "u"."id", "u"."name" from "users" as "u" inner join (select "id", "name" from "orders") as "o" on "u"."id" = "o"."id"';
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('leftJoin: single string column', () => {
        // Arrange
        const sql = 'SELECT u.id, u.name FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const subquery = SelectQueryParser.parse('SELECT id, name FROM orders') as SimpleSelectQuery;

        // Act
        query.leftJoin(subquery.toSource('o'), 'id');
        const result = formatter.format(query);

        // Assert
        const expected = 'select "u"."id", "u"."name" from "users" as "u" left join (select "id", "name" from "orders") as "o" on "u"."id" = "o"."id"';
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('rightJoin: single string column', () => {
        // Arrange
        const sql = 'SELECT u.id FROM users u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const subquery = SelectQueryParser.parse('SELECT id FROM orders') as SimpleSelectQuery;

        // Act
        query.rightJoin(subquery.toSource('o'), 'id');
        const result = formatter.format(query);

        // Assert
        const expected = 'select "u"."id" from "users" as "u" right join (select "id" from "orders") as "o" on "u"."id" = "o"."id"';
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('innerJoinRaw: throws if join column not found with wildcard select', () => {
        // Arrange
        const sql = 'SELECT * FROM users as u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        // Act & Assert
        expect(() => query.innerJoinRaw('posts', 'p', 'user_id')).toThrow('Invalid JOIN condition');
    });

    test('innerJoinRaw: resolves join column with wildcard select using TableColumnResolver', () => {
        // Arrange
        const sql = 'SELECT * FROM users as u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const resolver = (tableName: string) => {
            if (tableName === 'users') return ['user_id', 'name'];
            if (tableName === 'posts') return ['post_id', 'user_id', 'title'];
            return [];
        };

        // Act
        query.innerJoinRaw('posts', 'p', 'user_id', resolver);
        const formatter = new Formatter();
        const result = formatter.format(query);

        // Assert
        const expected = 'select * from "users" as "u" inner join "posts" as "p" on "u"."user_id" = "p"."user_id"';
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });
});
