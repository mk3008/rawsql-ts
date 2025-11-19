import { describe, it, expect } from 'vitest';
import { InsertQueryParser } from '../../src/parsers/InsertQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { InsertResultSelectConverter } from '../../src/transformers/InsertResultSelectConverter';
import type { TableDefinitionModel } from '../../src/models/TableDefinitionModel';
import type { FixtureTableDefinition } from '../../src/transformers/FixtureCteBuilder';

const formatter = () => new SqlFormatter();

describe('InsertResultSelectConverter', () => {
    const tableDefinition: TableDefinitionModel = {
        name: 'sale',
        columns: [
            { name: 'sale_date', typeName: 'date', required: true },
            { name: 'price', typeName: 'int', required: true },
            { name: 'created_at', typeName: 'timestamp', defaultValue: 'now()' }
        ]
    };

    it('builds a RETURNING select with casts and defaults', () => {
        const insert = InsertQueryParser.parse(
            `INSERT INTO sale (sale_date, price) VALUES ('2025-01-01', 100), ('2025-01-02', 200) RETURNING sale_date, price, created_at`
        );
        const converted = InsertResultSelectConverter.toSelectQuery(insert, {
            tableDefinitions: { sale: tableDefinition }
        });
        const sql = formatter().format(converted).formattedSql;

        expect(sql).toBe(
            "with \"__inserted_rows\"(\"sale_date\", \"price\") as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select \"__inserted_rows\".\"sale_date\", \"__inserted_rows\".\"price\", now() as \"created_at\" from \"__inserted_rows\""
        );
    });

    it('falls back to the registry when the resolver cannot resolve the table', () => {
        // Use a resolver that intentionally returns undefined to exercise the fallback path.
        const insert = InsertQueryParser.parse(
            `INSERT INTO sale (sale_date, price) VALUES ('2025-01-01', 100), ('2025-01-02', 200) RETURNING sale_date, price, created_at`
        );
        let resolverCalls: string[] = [];

        const converted = InsertResultSelectConverter.toSelectQuery(insert, {
            tableDefinitions: { sale: tableDefinition },
            tableDefinitionResolver: (tableName) => {
                resolverCalls.push(tableName);
                return undefined;
            }
        });
        const sql = formatter().format(converted).formattedSql;

        expect(resolverCalls).toEqual(['sale']);
        expect(sql).toBe(
            "with \"__inserted_rows\"(\"sale_date\", \"price\") as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\") select \"__inserted_rows\".\"sale_date\", \"__inserted_rows\".\"price\", now() as \"created_at\" from \"__inserted_rows\""
        );
    });

    it('throws when a required column without default is missing', () => {
        const insert = InsertQueryParser.parse(
            "INSERT INTO sale (sale_date) VALUES ('2025-01-01') RETURNING sale_date"
        );
        expect(() =>
            InsertResultSelectConverter.toSelectQuery(insert, {
                tableDefinitions: { sale: tableDefinition }
            })
        ).toThrowError("Required column 'price' is missing from INSERT, so conversion cannot proceed.");
    });

    it('produces a count(*) query when RETURNING is absent', () => {
        const insert = InsertQueryParser.parse("INSERT INTO sale (sale_date, price) SELECT '2025-01-01', 100");
        const converted = InsertResultSelectConverter.toSelectQuery(insert, {
            tableDefinitions: { sale: tableDefinition }
        });
        const sql = formatter().format(converted).formattedSql;

        expect(sql).toBe(
            "with \"__inserted_rows\"(\"sale_date\", \"price\") as (select cast('2025-01-01' as date), cast(100 as int)) select count(*) as \"count\" from \"__inserted_rows\""
        );
    });

    it('skips casts/defaults when table definition is omitted', () => {
        const insert = InsertQueryParser.parse(
            `INSERT INTO sale (sale_date, price) VALUES ('2025-01-01', 100), ('2025-01-02', 200) RETURNING sale_date, price`
        );
        const converted = InsertResultSelectConverter.toSelectQuery(insert);
        const sql = formatter().format(converted).formattedSql;

        expect(sql).toBe(
            "with \"__inserted_rows\"(\"sale_date\", \"price\") as (select '2025-01-01' as \"sale_date\", 100 as \"price\" union all select '2025-01-02' as \"sale_date\", 200 as \"price\") select \"__inserted_rows\".\"sale_date\", \"__inserted_rows\".\"price\" from \"__inserted_rows\""
        );
    });

    it('injects fixture CTEs when the source selects from physical tables', () => {
        const fixtures: FixtureTableDefinition[] = [
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

        const insert = InsertQueryParser.parse(
            "INSERT INTO sale (sale_date, price) SELECT sale_date, price FROM users RETURNING sale_date, price"
        );

        const converted = InsertResultSelectConverter.toSelectQuery(insert, {
            tableDefinitions: { sale: tableDefinition },
            fixtureTables: fixtures
        });

        const sql = formatter().format(converted).formattedSql;

        expect(sql).toBe(
            "with \"users\" as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\" union all select cast('2025-01-02' as date) as \"sale_date\", cast(200 as int) as \"price\"), \"__inserted_rows\"(\"sale_date\", \"price\") as (select cast(\"sale_date\" as date) as \"sale_date\", cast(\"price\" as int) as \"price\" from \"users\") select \"__inserted_rows\".\"sale_date\", \"__inserted_rows\".\"price\" from \"__inserted_rows\""
        );
    });

    it('throws when a referenced table lacks fixtures and the strategy is error', () => {
        const insert = InsertQueryParser.parse(
            "INSERT INTO sale (sale_date, price) SELECT sale_date, price FROM users RETURNING sale_date, price"
        );

        expect(() =>
            InsertResultSelectConverter.toSelectQuery(insert, {
                tableDefinitions: { sale: tableDefinition }
            })
        ).toThrowError(/fixture coverage: users/i);
    });

    it('checks fixtures for tables referenced inside subqueries', () => {
        // The missing fixture should still be reported when the table lives inside a nested FROM-source.
        const insert = InsertQueryParser.parse(
            "INSERT INTO sale (sale_date, price) SELECT sub.sale_date, sub.price FROM (SELECT sale_date, price FROM users) AS sub RETURNING sale_date, price"
        );

        expect(() =>
            InsertResultSelectConverter.toSelectQuery(insert, {
                tableDefinitions: { sale: tableDefinition }
            })
        ).toThrowError(/fixture coverage: users/i);
    });

    it('ignores CTE aliases when checking fixture coverage', () => {
        const insert = InsertQueryParser.parse(`
            WITH source AS (
                SELECT CAST('2025-01-01' AS date) AS sale_date, 100 AS price
            )
            INSERT INTO sale (sale_date, price)
            SELECT sale_date, price FROM source
            RETURNING sale_date, price
        `);

        const converted = InsertResultSelectConverter.toSelectQuery(insert, {
            tableDefinitions: { sale: tableDefinition }
        });
        const sql = formatter().format(converted).formattedSql;

        expect(sql).toBe(
            "with \"source\" as (select cast('2025-01-01' as date) as \"sale_date\", 100 as \"price\"), \"__inserted_rows\"(\"sale_date\", \"price\") as (select cast(\"sale_date\" as date) as \"sale_date\", cast(\"price\" as int) as \"price\" from \"source\") select \"__inserted_rows\".\"sale_date\", \"__inserted_rows\".\"price\" from \"__inserted_rows\""
        );
    });

    it('allows passthrough when missing fixtures are tolerated', () => {
        const insert = InsertQueryParser.parse(
            "INSERT INTO sale (sale_date, price) SELECT sale_date, price FROM users RETURNING sale_date, price"
        );

        const converted = InsertResultSelectConverter.toSelectQuery(insert, {
            tableDefinitions: { sale: tableDefinition },
            missingFixtureStrategy: 'passthrough'
        });

        const sql = formatter().format(converted).formattedSql;

        expect(sql).toBe(
            "with \"__inserted_rows\"(\"sale_date\", \"price\") as (select cast(\"sale_date\" as date) as \"sale_date\", cast(\"price\" as int) as \"price\" from \"users\") select \"__inserted_rows\".\"sale_date\", \"__inserted_rows\".\"price\" from \"__inserted_rows\""
        );
    });

    it('preserves expressions and aliases in RETURNING', () => {
        const insert = InsertQueryParser.parse(
            "INSERT INTO sale (sale_date, price) VALUES ('2025-01-01', 100) RETURNING lower(price) as lower_price"
        );

        const converted = InsertResultSelectConverter.toSelectQuery(insert, {
            tableDefinitions: { sale: tableDefinition }
        });

        const sql = formatter().format(converted).formattedSql;
        expect(sql).toBe(
            "with \"__inserted_rows\"(\"sale_date\", \"price\") as (select cast('2025-01-01' as date) as \"sale_date\", cast(100 as int) as \"price\") select lower(\"__inserted_rows\".\"price\") as \"lower_price\" from \"__inserted_rows\""
        );
    });
});
