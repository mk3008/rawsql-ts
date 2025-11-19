import { describe, expect, it } from 'vitest';
import { MergeQueryParser } from '../../src/parsers/MergeQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { MergeResultSelectConverter } from '../../src/transformers/MergeResultSelectConverter';
import type { FixtureTableDefinition } from '../../src/transformers/FixtureCteBuilder';

const formatter = () => new SqlFormatter();

describe('MergeResultSelectConverter', () => {
    it('builds a counting select that mirrors merge actions', () => {
        const merge = MergeQueryParser.parse(`
            MERGE INTO sale AS target
            USING (
                SELECT 1 AS id, '2025-01-01' AS sale_date, 100 AS price
                UNION ALL
                SELECT 2 AS id, '2025-01-02' AS sale_date, 200 AS price
            ) AS source
            ON target.id = source.id
            WHEN MATCHED THEN UPDATE SET price = source.price
            WHEN NOT MATCHED THEN INSERT (id, sale_date, price) VALUES (source.id, source.sale_date, source.price)
            WHEN NOT MATCHED BY SOURCE THEN DELETE
        `);

        const converted = MergeResultSelectConverter.toSelectQuery(merge, {
            missingFixtureStrategy: 'passthrough'
        });
        const sql = formatter().format(converted).formattedSql;

        expect(sql).toContain('select count(*) as "count"');
        expect(sql).toContain('as "__merge_action_rows"');
    });

    it('returns the exact formatted SQL for a basic merge flow', () => {
        const merge = MergeQueryParser.parse(`
            MERGE INTO sale AS target
            USING (
                SELECT 1 AS id, '2025-01-01' AS sale_date, 100 AS price
                UNION ALL
                SELECT 2 AS id, '2025-01-02' AS sale_date, 200 AS price
            ) AS source
            ON target.id = source.id
            WHEN MATCHED THEN UPDATE SET price = source.price
            WHEN NOT MATCHED THEN INSERT (id, sale_date, price) VALUES (source.id, source.sale_date, source.price)
            WHEN NOT MATCHED BY SOURCE THEN DELETE
        `);

        const converted = MergeResultSelectConverter.toSelectQuery(merge, {
            missingFixtureStrategy: 'passthrough'
        });
        const sql = formatter().format(converted).formattedSql;

        const expected =
"select count(*) as \"count\" from (select 1 from \"sale\" as \"target\" inner join (select 1 as \"id\", '2025-01-01' as \"sale_date\", 100 as \"price\" union all select 2 as \"id\", '2025-01-02' as \"sale_date\", 200 as \"price\") as \"source\" on \"target\".\"id\" = \"source\".\"id\" union all select 1 from (select 1 as \"id\", '2025-01-01' as \"sale_date\", 100 as \"price\" union all select 2 as \"id\", '2025-01-02' as \"sale_date\", 200 as \"price\") as \"source\" where not exists (select 1 from \"sale\" as \"target\" where \"target\".\"id\" = \"source\".\"id\") union all select 1 from \"sale\" as \"target\" where not exists (select 1 from (select 1 as \"id\", '2025-01-01' as \"sale_date\", 100 as \"price\" union all select 2 as \"id\", '2025-01-02' as \"sale_date\", 200 as \"price\") as \"source\" where \"target\".\"id\" = \"source\".\"id\")) as \"__merge_action_rows\"";

        expect(sql).toBe(expected);
    });

    it('injects fixture CTEs for tables referenced in the merge', () => {
        const fixtures: FixtureTableDefinition[] = [
            {
                tableName: 'sale',
                columns: [
                    { name: 'id', typeName: 'int' },
                    { name: 'price', typeName: 'int' }
                ],
                rows: [
                    [1, 100]
                ]
            },
            {
                tableName: 'users',
                columns: [
                    { name: 'id', typeName: 'int' },
                    { name: 'price', typeName: 'int' }
                ],
                rows: [
                    [1, 150]
                ]
            }
        ];

        const merge = MergeQueryParser.parse(`
            MERGE INTO sale AS target
            USING users AS source
            ON target.id = source.id
            WHEN MATCHED THEN UPDATE SET price = source.price
            WHEN NOT MATCHED THEN INSERT (id, price) VALUES (source.id, source.price)
        `);

        const converted = MergeResultSelectConverter.toSelectQuery(merge, {
            fixtureTables: fixtures
        });
        const sql = formatter().format(converted).formattedSql;

        expect(sql.toLowerCase()).toContain('"users" as');
        expect(sql.toLowerCase()).toContain('"sale" as');
    });

    it('ignores unused fixture definitions', () => {
        const fixtures: FixtureTableDefinition[] = [
            {
                tableName: 'sale',
                columns: [
                    { name: 'id', typeName: 'int' },
                    { name: 'price', typeName: 'int' }
                ],
                rows: [
                    [1, 100]
                ]
            },
            {
                tableName: 'users',
                columns: [
                    { name: 'id', typeName: 'int' },
                    { name: 'price', typeName: 'int' }
                ],
                rows: [
                    [1, 150]
                ]
            },
            {
                tableName: 'products',
                columns: [
                    { name: 'id', typeName: 'int' },
                    { name: 'sku', typeName: 'varchar' }
                ],
                rows: [
                    [42, 'X42']
                ]
            }
        ];

        const merge = MergeQueryParser.parse(`
            MERGE INTO sale AS target
            USING users AS source
            ON target.id = source.id
            WHEN MATCHED THEN UPDATE SET price = source.price
        `);

        const converted = MergeResultSelectConverter.toSelectQuery(merge, {
            fixtureTables: fixtures,
            missingFixtureStrategy: 'passthrough'
        });
        const sql = formatter().format(converted).formattedSql;

        expect(sql.toLowerCase()).not.toContain('"products" as');
    });

    it('throws when fixture coverage is missing', () => {
        const merge = MergeQueryParser.parse(`
            MERGE INTO sale AS target
            USING users AS source
            ON target.id = source.id
            WHEN MATCHED THEN UPDATE SET price = source.price
            WHEN NOT MATCHED THEN INSERT (id, price) VALUES (source.id, source.price)
        `);

        expect(() =>
            MergeResultSelectConverter.toSelectQuery(merge)
        ).toThrowError(/merge select refers to tables without fixture coverage/i);
    });
});
