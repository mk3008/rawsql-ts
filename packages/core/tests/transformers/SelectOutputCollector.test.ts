import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/Formatter';
import { SelectOutputCollector } from '../../src/transformers/SelectOutputCollector';
import { TableColumnResolver } from '../../src/transformers/TableColumnResolver';

const formatter = new SqlFormatter();

describe('SelectOutputCollector', () => {
    test('keeps duplicate output names with distinct output indexes', () => {
        const sql = `
            SELECT
                c.id,
                o.id
            FROM customers AS c
            JOIN orders AS o ON o.customer_id = c.id
        `;
        const query = SelectQueryParser.parse(sql);

        const outputs = new SelectOutputCollector().collect(query);

        expect(outputs.map(item => ({
            name: item.name,
            outputIndex: item.outputIndex,
            sql: formatter.format(item.value).formattedSql
        }))).toEqual([
            { name: 'id', outputIndex: 0, sql: '"c"."id"' },
            { name: 'id', outputIndex: 1, sql: '"o"."id"' }
        ]);
    });

    test('preserves wildcard plus explicit output order with resolver expansion', () => {
        const resolver: TableColumnResolver = tableName => {
            if (tableName === 'scored') {
                return ['customer_id', 'amount'];
            }
            return [];
        };
        const sql = `
            SELECT
                s.*,
                s.amount * 2 AS score
            FROM scored AS s
        `;
        const query = SelectQueryParser.parse(sql);

        const outputs = new SelectOutputCollector(resolver).collect(query);

        expect(outputs.map(item => ({
            name: item.name,
            outputIndex: item.outputIndex,
            sql: formatter.format(item.value).formattedSql
        }))).toEqual([
            { name: 'customer_id', outputIndex: 0, sql: '"s"."customer_id"' },
            { name: 'amount', outputIndex: 1, sql: '"s"."amount"' },
            { name: 'score', outputIndex: 2, sql: '"s"."amount" * 2' }
        ]);
    });

    test('expands CTE wildcard outputs from syntax with stable output indexes', () => {
        const sql = `
            WITH scored AS (
                SELECT
                    customer_id,
                    amount,
                    amount * 2 AS doubled
                FROM orders
            )
            SELECT
                s.*,
                s.amount + 1 AS adjusted_amount
            FROM scored AS s
        `;
        const query = SelectQueryParser.parse(sql);

        const outputs = new SelectOutputCollector().collect(query);

        expect(outputs.map(item => ({
            name: item.name,
            outputIndex: item.outputIndex,
            sourceAlias: item.sourceAlias,
            sourceName: item.sourceName,
            sourceColumnName: item.sourceColumnName,
            sql: formatter.format(item.value).formattedSql
        }))).toEqual([
            { name: 'customer_id', outputIndex: 0, sourceAlias: 's', sourceName: 'scored', sourceColumnName: 'customer_id', sql: '"s"."customer_id"' },
            { name: 'amount', outputIndex: 1, sourceAlias: 's', sourceName: 'scored', sourceColumnName: 'amount', sql: '"s"."amount"' },
            { name: 'doubled', outputIndex: 2, sourceAlias: 's', sourceName: 'scored', sourceColumnName: 'doubled', sql: '"s"."doubled"' },
            { name: 'adjusted_amount', outputIndex: 3, sourceAlias: null, sourceName: null, sourceColumnName: null, sql: '"s"."amount" + 1' }
        ]);
    });

    test('expands derived table wildcard outputs with source metadata', () => {
        const sql = `
            SELECT
                d.*,
                d.a + d.b AS total
            FROM (
                SELECT
                    a,
                    b
                FROM t
            ) AS d
        `;
        const query = SelectQueryParser.parse(sql);

        const outputs = new SelectOutputCollector().collect(query);

        expect(outputs.map(item => ({
            name: item.name,
            outputIndex: item.outputIndex,
            sourceAlias: item.sourceAlias,
            sourceName: item.sourceName,
            sourceColumnName: item.sourceColumnName,
            sql: formatter.format(item.value).formattedSql
        }))).toEqual([
            { name: 'a', outputIndex: 0, sourceAlias: 'd', sourceName: null, sourceColumnName: 'a', sql: '"d"."a"' },
            { name: 'b', outputIndex: 1, sourceAlias: 'd', sourceName: null, sourceColumnName: 'b', sql: '"d"."b"' },
            { name: 'total', outputIndex: 2, sourceAlias: null, sourceName: null, sourceColumnName: null, sql: '"d"."a" + "d"."b"' }
        ]);
    });

    test('keeps duplicate wildcard output names with source metadata', () => {
        const sql = `
            SELECT
                d.*
            FROM (
                SELECT
                    c.id,
                    o.id
                FROM customers AS c
                JOIN orders AS o ON o.customer_id = c.id
            ) AS d
        `;
        const query = SelectQueryParser.parse(sql);

        const outputs = new SelectOutputCollector().collect(query);

        expect(outputs.map(item => ({
            name: item.name,
            outputIndex: item.outputIndex,
            sourceAlias: item.sourceAlias,
            sourceName: item.sourceName,
            sourceColumnName: item.sourceColumnName,
            sql: formatter.format(item.value).formattedSql
        }))).toEqual([
            { name: 'id', outputIndex: 0, sourceAlias: 'd', sourceName: null, sourceColumnName: 'id', sql: '"d"."id"' },
            { name: 'id', outputIndex: 1, sourceAlias: 'd', sourceName: null, sourceColumnName: 'id', sql: '"d"."id"' }
        ]);
    });
});
