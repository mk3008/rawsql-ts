import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/visitors/Formatter';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';

const formatter = new Formatter();

describe('SimpleSelectQuery JOIN API', () => {
    test('innerJoin: basic usage', () => {
        // Arrange
        const sql = 'SELECT u.id, u.name FROM users u';
        const query = SelectQueryParser.parseFromText(sql) as SimpleSelectQuery;
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
        const query = SelectQueryParser.parseFromText(sql) as SimpleSelectQuery;
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
        const query = SelectQueryParser.parseFromText(sql) as SimpleSelectQuery;
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
        const query = SelectQueryParser.parseFromText(sql) as SimpleSelectQuery;
        // Act & Assert
        expect(() => query.innerJoinRaw('orders', 'o', ['not_exist'])).toThrow();
    });

    test('throws if FROM clause is missing', () => {
        // Arrange
        const sql = 'SELECT 1 as id';
        const query = SelectQueryParser.parseFromText(sql) as SimpleSelectQuery;
        // Act & Assert
        expect(() => query.innerJoinRaw('orders', 'o', ['id'])).toThrow();
    });
});
