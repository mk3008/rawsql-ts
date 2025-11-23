import { describe, expect, it } from 'vitest';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { FixtureCteBuilder, type FixtureTableDefinition } from '../../src/transformers/FixtureCteBuilder';

const formatter = new SqlFormatter();

describe('FixtureCteBuilder', () => {
    it('generates casts, binary literals, and unions for populated fixtures', () => {
        // Mix typed columns with Buffer/null values so we can assert how literals are rendered.
        const fixtures: FixtureTableDefinition[] = [
            {
                tableName: 'users',
                columns: [
                    { name: 'sale_date', typeName: 'date' },
                    { name: 'price', typeName: 'int' },
                    { name: 'blob_data' }
                ],
                rows: [
                    ['2025-01-01', 100, Buffer.from('abc')],
                    ['2025-01-02', 200, null]
                ]
            }
        ];

        const ctes = FixtureCteBuilder.buildFixtures(fixtures);
        expect(ctes).toHaveLength(1);
        expect(ctes[0].getSourceAliasName()).toBe('users');

        // Format the generated query to lock down the normalized SELECT statement.
        const selectSql = formatter.format(ctes[0].query).formattedSql;

        expect(selectSql).toBe(
            'select cast(\'2025-01-01\' as date) as "sale_date", cast(100 as int) as "price", X\'616263\' as "blob_data" union all select cast(\'2025-01-02\' as date) as "sale_date", cast(200 as int) as "price", null as "blob_data"'
        );
    });

    it('renders boolean literals without quotes', () => {
        const booleanRows = [
            [true],
            [false]
        ] as unknown as (string | number | bigint | Buffer | null)[][];

        const fixtures: FixtureTableDefinition[] = [
            {
                tableName: 'flags',
                columns: [{ name: 'flag' }],
                rows: booleanRows
            }
        ];

        const [cte] = FixtureCteBuilder.buildFixtures(fixtures);
        const selectSql = formatter.format(cte.query).formattedSql;

        expect(selectSql).toBe('select true as "flag" union all select false as "flag"');
    });

    it('emits a null row with a WHERE 1 = 0 guard when no fixture rows exist', () => {
        // Force the builder to fall back to a placeholder row so callers can still inject the CTE.
        const fixtures: FixtureTableDefinition[] = [
            {
                tableName: 'empty',
                columns: [
                    { name: 'id' },
                    { name: 'value' }
                ],
                rows: []
            }
        ];

        const [cte] = FixtureCteBuilder.buildFixtures(fixtures);

        // Format the fallback SELECT to ensure the empty result still has a WHERE clause entry.
        const selectSql = formatter.format(cte.query).formattedSql;

        expect(selectSql).toBe('select null as "id", null as "value"');
        expect(cte.query.toSimpleQuery().whereClause).not.toBeNull();
    });

    it('creates fixtures from SQL string', () => {
        const sql = `
            CREATE TABLE users (id INT, name TEXT);
            INSERT INTO users VALUES (1, 'Alice');
        `;
        const fixtures = FixtureCteBuilder.fromSQL(sql);
        expect(fixtures).toHaveLength(1);
        expect(fixtures[0].tableName).toBe('users');
        expect(fixtures[0].rows).toEqual([[1, 'Alice']]);
    });
});
