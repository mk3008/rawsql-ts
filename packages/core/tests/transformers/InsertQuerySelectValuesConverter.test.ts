import { describe, it, expect } from 'vitest';
import { InsertQueryParser } from '../../src/parsers/InsertQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { InsertQuerySelectValuesConverter } from '../../src/transformers/InsertQuerySelectValuesConverter';

const formatter = () => new SqlFormatter();

describe('InsertQuerySelectValuesConverter', () => {
    const valuesSql = `INSERT INTO sale (sale_date, price, created_at) VALUES
    ('2023-01-01',160,'2024-01-11 14:29:01.618'),
    ('2023-03-12',200,'2024-01-11 14:29:01.618')`;

    const unionSql = `INSERT INTO sale(sale_date, price, created_at)
SELECT '2023-01-01' AS sale_date, 160 AS price, '2024-01-11 14:29:01.618' AS created_at
UNION ALL
SELECT '2023-03-12' AS sale_date, 200 AS price, '2024-01-11 14:29:01.618' AS created_at`;

    it('converts VALUES form to SELECT UNION ALL form', () => {
        const insert = InsertQueryParser.parse(valuesSql);
        const converted = InsertQuerySelectValuesConverter.toSelectUnion(insert);
        const sql = formatter().format(converted).formattedSql;

        expect(sql).toBe(
            "insert into \"sale\"(\"sale_date\", \"price\", \"created_at\") select '2023-01-01' as \"sale_date\", 160 as \"price\", '2024-01-11 14:29:01.618' as \"created_at\" union all select '2023-03-12' as \"sale_date\", 200 as \"price\", '2024-01-11 14:29:01.618' as \"created_at\""
        );
    });

    it('converts SELECT UNION ALL form back to VALUES form', () => {
        const insert = InsertQueryParser.parse(unionSql);
        const converted = InsertQuerySelectValuesConverter.toValues(insert);
        const sql = formatter().format(converted).formattedSql;

        expect(sql).toBe(
            "insert into \"sale\"(\"sale_date\", \"price\", \"created_at\") values ('2023-01-01', 160, '2024-01-11 14:29:01.618'), ('2023-03-12', 200, '2024-01-11 14:29:01.618')"
        );
    });

    it('round-trips VALUES -> SELECT -> VALUES without loss', () => {
        const insert = InsertQueryParser.parse(valuesSql);
        const toSelect = InsertQuerySelectValuesConverter.toSelectUnion(insert);
        const roundTrip = InsertQuerySelectValuesConverter.toValues(toSelect);
        const sql = formatter().format(roundTrip).formattedSql;

        expect(sql).toBe(
            "insert into \"sale\"(\"sale_date\", \"price\", \"created_at\") values ('2023-01-01', 160, '2024-01-11 14:29:01.618'), ('2023-03-12', 200, '2024-01-11 14:29:01.618')"
        );
    });

    it('throws when converting VALUES without explicit column list', () => {
        const insert = InsertQueryParser.parse("INSERT INTO sale VALUES ('2023-01-01')");
        expect(() => InsertQuerySelectValuesConverter.toSelectUnion(insert)).toThrowError(
            "Cannot convert to SELECT form without explicit column list."
        );
    });

    it('throws when SELECT items lack required aliases during conversion to VALUES', () => {
        const insert = InsertQueryParser.parse(`INSERT INTO sale(sale_date, price) SELECT '2023-01-01', 160`);
        expect(() => InsertQuerySelectValuesConverter.toValues(insert)).toThrowError(
            "Each SELECT item must have an alias matching target columns."
        );
    });

    it('throws when converting SELECT queries with FROM clause to VALUES form', () => {
        const insert = InsertQueryParser.parse(
            `INSERT INTO sale(sale_date, price, created_at)
SELECT sale_date AS sale_date, price AS price, created_at AS created_at FROM sale_staging`
        );
        expect(() => InsertQuerySelectValuesConverter.toValues(insert)).toThrowError(
            'SELECT queries with FROM or WHERE clauses cannot be converted to VALUES.'
        );
    });

    it('throws when VALUES tuples do not match column length during SELECT conversion', () => {
        const insert = InsertQueryParser.parse(
            `INSERT INTO sale(sale_date, price) VALUES ('2023-01-01', 160, '2024-01-11 14:29:01.618')`
        );
        expect(() => InsertQuerySelectValuesConverter.toSelectUnion(insert)).toThrowError(
            'Tuple value count does not match column count.'
        );
    });
});
