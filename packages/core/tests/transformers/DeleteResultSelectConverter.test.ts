import { describe, expect, it } from 'vitest';
import { DeleteQueryParser } from '../../src/parsers/DeleteQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { DeleteResultSelectConverter } from '../../src/transformers/DeleteResultSelectConverter';
import type { TableDefinitionModel } from '../../src/models/TableDefinitionModel';
import type { FixtureTableDefinition } from '../../src/transformers/FixtureCteBuilder';

const formatter = () => new SqlFormatter();

describe('DeleteResultSelectConverter', () => {
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

    it('builds a RETURNING select for deleted rows', () => {
        const deleteQuery = DeleteQueryParser.parse(
            "DELETE FROM sale WHERE sale_date = '2025-01-01' RETURNING sale_date, price"
        );

        const converted = DeleteResultSelectConverter.toSelectQuery(deleteQuery, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: fixtures
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select \"sale\".\"sale_date\", \"sale\".\"price\" from \"sale\" where \"sale_date\" = '2025-01-01'"
        );
    });

    it('produces count(*) when RETURNING is absent', () => {
        const deleteQuery = DeleteQueryParser.parse(
            "DELETE FROM sale WHERE sale_date = '2025-01-01'"
        );

        const converted = DeleteResultSelectConverter.toSelectQuery(deleteQuery, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: fixtures
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select count(*) as \"count\" from \"sale\" where \"sale_date\" = '2025-01-01'"
        );
    });

    it('ignores CTE aliases when checking fixture coverage', () => {
        const deleteQuery = DeleteQueryParser.parse(
            `
            with source as (
                select '2025-01-01' as sale_date, 100 as price
            )
            delete from source
            returning sale_date, price
        `
        );

        const converted = DeleteResultSelectConverter.toSelectQuery(deleteQuery, {
            missingFixtureStrategy: 'error'
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"source\" as (select '2025-01-01' as \"sale_date\", 100 as \"price\") select \"source\".\"sale_date\", \"source\".\"price\" from \"source\""
        );
    });

    it('expands RETURNING * when a table definition is supplied', () => {
        const deleteQuery = DeleteQueryParser.parse("DELETE FROM sale RETURNING *");

        const converted = DeleteResultSelectConverter.toSelectQuery(deleteQuery, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: fixtures
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select \"sale\".\"sale_date\", \"sale\".\"price\", \"sale\".\"created_at\" from \"sale\""
        );
    });

    it('injects fixture CTEs when USING references physical tables', () => {
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

        const deleteQuery = DeleteQueryParser.parse(
            'DELETE FROM sale USING users WHERE sale.sale_date = users.sale_date RETURNING sale_date, price'
        );

        const converted = DeleteResultSelectConverter.toSelectQuery(deleteQuery, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\"), \"users\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select \"sale\".\"sale_date\", \"sale\".\"price\" from \"sale\" cross join \"users\" where \"sale\".\"sale_date\" = \"users\".\"sale_date\""
        );
    });

    it('allows RETURNING columns from USING tables', () => {
        const userDefinition: TableDefinitionModel = {
            name: 'users',
            columns: [
                { name: 'sale_date', typeName: 'date', required: true },
                { name: 'price', typeName: 'int', required: true }
            ]
        };

        const fixtureTablesForUsers: FixtureTableDefinition[] = [
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

        const deleteQuery = DeleteQueryParser.parse(
            'DELETE FROM sale USING users WHERE sale.sale_date = users.sale_date RETURNING users.sale_date'
        );

        const converted = DeleteResultSelectConverter.toSelectQuery(deleteQuery, {
            tableDefinitions: {
                sale: tableDefinition,
                users: userDefinition
            },
            fixtureTables: fixtureTablesForUsers
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\"), \"users\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select \"users\".\"sale_date\" from \"sale\" cross join \"users\" where \"sale\".\"sale_date\" = \"users\".\"sale_date\""
        );
    });

    it('requires fixture coverage for referenced tables by default', () => {
        const deleteQuery = DeleteQueryParser.parse('DELETE FROM sale USING users WHERE sale.sale_date = users.sale_date RETURNING sale_date');

        expect(() =>
            DeleteResultSelectConverter.toSelectQuery(deleteQuery, {
                tableDefinitions: { sale: tableDefinition }
            })
        ).toThrowError(/fixture coverage.*users/i);
    });

    it('allows passthrough when missing fixtures are tolerated', () => {
        const deleteQuery = DeleteQueryParser.parse('DELETE FROM sale USING users WHERE sale.sale_date = users.sale_date RETURNING sale_date');

        const converted = DeleteResultSelectConverter.toSelectQuery(deleteQuery, {
            tableDefinitions: { sale: tableDefinition },
            missingFixtureStrategy: 'passthrough'
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "select \"sale\".\"sale_date\" from \"sale\" cross join \"users\" where \"sale\".\"sale_date\" = \"users\".\"sale_date\""
        );
    });

    it('keeps RETURNING expressions intact', () => {
        const deleteQuery = DeleteQueryParser.parse(
            "DELETE FROM sale WHERE sale_date = '2025-01-01' RETURNING lower(price) as lower_price"
        );

        const converted = DeleteResultSelectConverter.toSelectQuery(deleteQuery, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: fixtures
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"sale\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select lower(\"sale\".\"price\") as \"lower_price\" from \"sale\" where \"sale_date\" = '2025-01-01'"
        );
    });
});
