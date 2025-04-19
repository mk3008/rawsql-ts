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
        const result = formatter.visit(query);
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
        const result = formatter.visit(query);
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
        const result = formatter.visit(query);
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
        // Pass a subquery as a string wrapped in parentheses (alias is o)
        query.innerJoinRaw(`(${subquery})`, 'o', ['id']);

        // Act
        const result = formatter.visit(query);
        const expected = 'select "u"."id", "u"."name" from "users" as "u" inner join (select "id", "name" from "orders" where "status" = \'active\') as "o" on "u"."id" = "o"."id"';

        // Assert
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });

    test('innerJoinRaw: join with subquery and both queries have WITH clause', () => {
        // Arrange
        const subquery = `WITH sub_orders AS (SELECT id, name FROM orders WHERE status = 'active') SELECT id, name FROM sub_orders`;
        const sql = `WITH sub_users AS (SELECT id, name FROM users WHERE active = true) SELECT u.id, u.name FROM sub_users u`;
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        // Join with subquery (with its own WITH clause)
        query.innerJoinRaw(`(${subquery})`, 'o', ['id']);

        // Act
        const result = formatter.visit(query);
        // The expected SQL should have both WITH clauses merged at the top level
        const expected = 'with "sub_orders" as (select "id", "name" from "orders" where "status" = \'active\'), "sub_users" as (select "id", "name" from "users" where "active" = true) select "u"."id", "u"."name" from "sub_users" as "u" inner join (select "id", "name" from "sub_orders") as "o" on "u"."id" = "o"."id"';

        // Assert
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
        const result = formatter.visit(query);
        const expected = 'select "u"."id", "u"."name" from "users" as "u" inner join (select "id", "name" from "orders" where "status" = "active") as "o" on "u"."id" = "o"."id"';

        // Assert
        expect(result.replace(/\s+/g, ' ').trim()).toBe(expected);
    });
});
