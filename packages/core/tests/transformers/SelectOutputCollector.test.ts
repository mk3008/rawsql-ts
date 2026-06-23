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
            sql: formatter.format(item.value).formattedSql
        }))).toEqual([
            { name: 'customer_id', outputIndex: 0, sql: '"s"."customer_id"' },
            { name: 'amount', outputIndex: 1, sql: '"s"."amount"' },
            { name: 'doubled', outputIndex: 2, sql: '"s"."doubled"' },
            { name: 'adjusted_amount', outputIndex: 3, sql: '"s"."amount" + 1' }
        ]);
    });
});
