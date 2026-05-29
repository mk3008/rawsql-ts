import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';

const formatter = new Formatter();

const joinApiCases = [
    {
        name: 'innerJoinRaw basic usage',
        kind: 'innerJoinRaw',
        sql: 'SELECT u.id, u.name FROM users u',
        source: 'orders',
        alias: 'o',
        columns: ['id'],
        expected: 'select "u"."id", "u"."name" from "users" as "u" inner join "orders" as "o" on "u"."id" = "o"."id"',
    },
    {
        name: 'leftJoinRaw multi-column',
        kind: 'leftJoinRaw',
        sql: 'SELECT u.id, u.name FROM users u',
        source: 'orders',
        alias: 'o',
        columns: ['id', 'name'],
        expected: 'select "u"."id", "u"."name" from "users" as "u" left join "orders" as "o" on "u"."id" = "o"."id" and "u"."name" = "o"."name"',
    },
    {
        name: 'rightJoinRaw schema qualified',
        kind: 'rightJoinRaw',
        sql: 'SELECT u.id FROM users u',
        source: 'public.orders',
        alias: 'o',
        columns: ['id'],
        expected: 'select "u"."id" from "users" as "u" right join "public"."orders" as "o" on "u"."id" = "o"."id"',
    },
    {
        name: 'innerJoinRaw subquery',
        kind: 'innerJoinRaw',
        sql: 'SELECT u.id, u.name FROM users u',
        source: "(SELECT id, name FROM orders WHERE status = 'active')",
        alias: 'o',
        columns: ['id'],
        expected: 'select "u"."id", "u"."name" from "users" as "u" inner join (select "id", "name" from "orders" where "status" = \'active\') as "o" on "u"."id" = "o"."id"',
    },
    {
        name: 'innerJoinRaw with merged WITH clauses',
        kind: 'innerJoinRaw',
        sql: "WITH sub_users AS (SELECT id, name FROM users WHERE active = true) SELECT u.id, u.name FROM sub_users u",
        source: "(WITH sub_orders AS (SELECT id, name FROM orders WHERE status = 'active') SELECT id, name FROM sub_orders)",
        alias: 'o',
        columns: ['id'],
        expected: 'with "sub_orders" as (select "id", "name" from "orders" where "status" = \'active\'), "sub_users" as (select "id", "name" from "users" where "active" = true) select "u"."id", "u"."name" from "sub_users" as "u" inner join (select "id", "name" from "sub_orders") as "o" on "u"."id" = "o"."id"',
    },
    {
        name: 'innerJoin toSource',
        kind: 'innerJoin',
        sql: 'SELECT u.id, u.name FROM users u',
        source: 'SELECT id, name FROM orders WHERE status = "active"',
        alias: 'o',
        columns: ['id'],
        expected: 'select "u"."id", "u"."name" from "users" as "u" inner join (select "id", "name" from "orders" where "status" = "active") as "o" on "u"."id" = "o"."id"',
    },
    {
        name: 'leftJoin toSource single string column',
        kind: 'leftJoin',
        sql: 'SELECT u.id, u.name FROM users u',
        source: 'SELECT id, name FROM orders',
        alias: 'o',
        columns: 'id',
        expected: 'select "u"."id", "u"."name" from "users" as "u" left join (select "id", "name" from "orders") as "o" on "u"."id" = "o"."id"',
    },
    {
        name: 'rightJoin toSource single string column',
        kind: 'rightJoin',
        sql: 'SELECT u.id FROM users u',
        source: 'SELECT id FROM orders',
        alias: 'o',
        columns: 'id',
        expected: 'select "u"."id" from "users" as "u" right join (select "id" from "orders") as "o" on "u"."id" = "o"."id"',
    },
    {
        name: 'wildcard select with resolver',
        kind: 'innerJoinRawWithResolver',
        sql: 'SELECT * FROM users as u',
        source: 'posts',
        alias: 'p',
        columns: 'user_id',
        expected: 'select * from "users" as "u" inner join "posts" as "p" on "u"."user_id" = "p"."user_id"',
    },
] as const;

type JoinApiCase = typeof joinApiCases[number];

function applyJoinCase(query: SimpleSelectQuery, joinCase: JoinApiCase): void {
    if (joinCase.kind === 'innerJoinRaw') {
        query.innerJoinRaw(joinCase.source, joinCase.alias, joinCase.columns);
        return;
    }
    if (joinCase.kind === 'leftJoinRaw') {
        query.leftJoinRaw(joinCase.source, joinCase.alias, joinCase.columns);
        return;
    }
    if (joinCase.kind === 'rightJoinRaw') {
        query.rightJoinRaw(joinCase.source, joinCase.alias, joinCase.columns);
        return;
    }
    if (joinCase.kind === 'innerJoinRawWithResolver') {
        const resolver = (tableName: string) => {
            if (tableName === 'users') return ['user_id', 'name'];
            if (tableName === 'posts') return ['post_id', 'user_id', 'title'];
            return [];
        };
        query.innerJoinRaw(joinCase.source, joinCase.alias, joinCase.columns, resolver);
        return;
    }

    const subquery = SelectQueryParser.parse(joinCase.source) as SimpleSelectQuery;
    if (joinCase.kind === 'innerJoin') {
        query.innerJoin(subquery.toSource(joinCase.alias), joinCase.columns);
        return;
    }
    if (joinCase.kind === 'leftJoin') {
        query.leftJoin(subquery.toSource(joinCase.alias), joinCase.columns);
        return;
    }
    query.rightJoin(subquery.toSource(joinCase.alias), joinCase.columns);
}

describe('SimpleSelectQuery JOIN API', () => {
    test('formats generated JOIN API scenarios as expected', () => {
        fc.assert(
            fc.property(fc.constantFrom(...joinApiCases), (joinCase) => {
                const query = SelectQueryParser.parse(joinCase.sql) as SimpleSelectQuery;
                applyJoinCase(query, joinCase);
                const result = formatter.format(query);
                expect(result.replace(/\s+/g, ' ').trim(), joinCase.name).toBe(joinCase.expected);
            }),
            { numRuns: joinApiCases.length * 3 }
        );
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

    test('innerJoinRaw: throws if join column not found with wildcard select', () => {
        // Arrange
        const sql = 'SELECT * FROM users as u';
        const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        // Act & Assert
        expect(() => query.innerJoinRaw('posts', 'p', 'user_id')).toThrow('Invalid JOIN condition');
    });

});
