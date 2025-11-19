import { describe, it, expect } from 'vitest';
import { UpdateQueryParser } from '../../src/parsers/UpdateQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { UpdateResultSelectConverter } from '../../src/transformers/UpdateResultSelectConverter';
import type { TableDefinitionModel } from '../../src/models/TableDefinitionModel';
import type { FixtureTableDefinition } from '../../src/transformers/FixtureCteBuilder';

const formatter = () => new SqlFormatter();

describe('UpdateResultSelectConverter', () => {
    const tableDefinition: TableDefinitionModel = {
        name: 'sale',
        columns: [
            { name: 'sale_date', typeName: 'date', required: true },
            { name: 'price', typeName: 'int', required: true },
            { name: 'created_at', typeName: 'timestamp', defaultValue: 'now()' }
        ]
    };

    const fixtures: FixtureTableDefinition[] = [
        {
            tableName: 'sale',
            columns: [
                { name: 'sale_date', typeName: 'date' },
                { name: 'price', typeName: 'int' }
            ],
            rows: [
                ['2025-01-01', 100],
                ['2025-01-02', 200]
            ]
        }
    ];

    it('builds a RETURNING select for updated columns', () => {
        const update = UpdateQueryParser.parse(
            "UPDATE sale SET price = price + 10 WHERE sale_date = '2025-01-01' RETURNING sale_date, price"
        );

        const converted = UpdateResultSelectConverter.toSelectQuery(update, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: fixtures
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select \"sale\".\"sale_date\", \"price\" + 10 as \"price\" from \"sale\" where \"sale_date\" = '2025-01-01'"
        );
    });

    it('produces count(*) when RETURNING is absent', () => {
        const update = UpdateQueryParser.parse(
            "UPDATE sale SET price = price + 10 WHERE sale_date = '2025-01-01'"
        );

        const converted = UpdateResultSelectConverter.toSelectQuery(update, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: fixtures
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select count(*) as \"count\" from \"sale\" where \"sale_date\" = '2025-01-01'"
        );
    });

    it('expands RETURNING * when a table definition is supplied', () => {
        const update = UpdateQueryParser.parse(
            'UPDATE sale SET price = price + 10 RETURNING *'
        );

        const converted = UpdateResultSelectConverter.toSelectQuery(update, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: fixtures
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            'with "sale" as (select cast(\'2025-01-01\' as date) as "sale_date", cast(100 as int) as "price" union all select cast(\'2025-01-02\' as date) as "sale_date", cast(200 as int) as "price") select "sale"."sale_date", "price" + 10 as "price", "sale"."created_at" from "sale"'
        );
    });

    it('injects fixture CTEs when the source selects from physical tables', () => {
        // Arrange fixture coverage for the target and the physical users table referenced in the FROM clause.
        const fixtureTables: FixtureTableDefinition[] = [
            ...fixtures,
            {
                tableName: 'users',
                columns: [
                    { name: 'sale_date', typeName: 'date' },
                    { name: 'price', typeName: 'int' }
                ],
                rows: [
                    ['2025-01-01', 100],
                    ['2025-01-02', 200]
                ]
            }
        ];

        const update = UpdateQueryParser.parse(
            "UPDATE sale SET price = price + users.price FROM users WHERE sale.sale_date = users.sale_date RETURNING sale_date, price"
        );

        const converted = UpdateResultSelectConverter.toSelectQuery(update, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\"), \"users\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select \"sale\".\"sale_date\", \"price\" + \"users\".\"price\" as \"price\" from \"sale\" cross join \"users\" where \"sale\".\"sale_date\" = \"users\".\"sale_date\""
        );
    });

    it('requires fixture coverage for referenced tables by default', () => {
        const update = UpdateQueryParser.parse(
            'UPDATE sale SET price = price + 10 RETURNING sale_date'
        );

        expect(() =>
            UpdateResultSelectConverter.toSelectQuery(update, {
                tableDefinitions: { sale: tableDefinition }
            })
        ).toThrowError(/fixture coverage.*sale/i);
    });

    it('ignores CTE aliases when checking fixture coverage', () => {
        const update = UpdateQueryParser.parse(`
            WITH source AS (
                SELECT CAST('2025-01-01' AS date) AS sale_date, 100 AS price
            )
            UPDATE sale SET price = price + 10 FROM source WHERE sale.sale_date = source.sale_date RETURNING sale_date, price
        `);

        const converted = UpdateResultSelectConverter.toSelectQuery(update, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: fixtures
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\"), \"source\" as (select cast('2025-01-01' as date) as \"sale_date\", 100 as \"price\") select \"sale\".\"sale_date\", \"price\" + 10 as \"price\" from \"sale\" cross join \"source\" where \"sale\".\"sale_date\" = \"source\".\"sale_date\""
        );
    });

    it('ignores unused fixture definitions', () => {
        const update = UpdateQueryParser.parse(
            "UPDATE sale SET price = price + 10 RETURNING sale_date, price"
        );

        const unusedFixture: FixtureTableDefinition = {
            tableName: 'users',
            columns: [
                { name: 'id', typeName: 'int' },
                { name: 'name', typeName: 'varchar' }
            ],
            rows: [
                [1, 'Alice'],
                [2, 'Bob']
            ]
        };

        const converted = UpdateResultSelectConverter.toSelectQuery(update, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: [...fixtures, unusedFixture]
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql.toLowerCase()).not.toContain('"users" as');
    });

    it('preserves expressions in the RETURNING list', () => {
        const update = UpdateQueryParser.parse(
            "UPDATE sale SET price = price + 10 WHERE sale_date = '2025-01-01' RETURNING lower(price) as lower_price"
        );

        const converted = UpdateResultSelectConverter.toSelectQuery(update, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: fixtures
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select lower(\"price\" + 10) as \"lower_price\" from \"sale\" where \"sale_date\" = '2025-01-01'"
        );
    });
});
