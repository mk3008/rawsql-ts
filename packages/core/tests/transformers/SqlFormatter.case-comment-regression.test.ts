import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter CASE comment positioning', () => {
    const createFormatter = () => new SqlFormatter({
        exportComment: true,
        indentChar: ' ' as const,
        indentSize: 4,
        newline: '\n' as const,
    });

    it('places leading comments before CASE expressions in SELECT items', () => {
        const formatter = createFormatter();
        const sql = `select
    --c1
    case when true then 1 else 0 end`;
        const parsed = SelectQueryParser.parse(sql);
        const result = formatter.format(parsed).formattedSql;

        const expected = `select
    /* c1 */
    case
        when true then
            1
        else
            0
    end`;

        expect(result).toBe(expected);
    });

    it('keeps trailing comments after CASE expressions intact', () => {
        const formatter = createFormatter();
        const sql = `select
    case when true then 1 else 0 end
    --c2
;`;
        const parsed = SelectQueryParser.parse(sql);
        const result = formatter.format(parsed).formattedSql;

        const expected = `select
    case
        when true then
            1
        else
            0
    end
    /* c2 */`;

        expect(result).toBe(expected);
    });

    it('preserves inline comments within CASE expression predicates', () => {
        const formatter = createFormatter();
        const sql = `select case when true --k1
    then 1 else 0 end`;
        const parsed = SelectQueryParser.parse(sql);
        const result = formatter.format(parsed).formattedSql;

        const expected = `select
    case
        when true /* k1 */
        then
            1
        else
            0
    end`;

        expect(result).toBe(expected);
    });

    it('keeps comments between CASE and the first WHEN inside the CASE expression', () => {
        const formatter = createFormatter();
        const sql = `select
    case
        /* rank judgement */
        when amount >= 100000 then 'vip'
        else 'normal'
    end as customer_rank`;
        const parsed = SelectQueryParser.parse(sql);
        const result = formatter.format(parsed).formattedSql;

        const expected = `select
    case
        /* rank judgement */
        when "amount" >= 100000 then
            'vip'
        else
            'normal'
    end as "customer_rank"`;

        expect(result).toBe(expected);
    });
});
