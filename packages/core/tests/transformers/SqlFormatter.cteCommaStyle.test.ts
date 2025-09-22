import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const sqlWithTwoCtes = `WITH
cte1 AS (
  SELECT 1
),
cte2 AS (
  SELECT 2
)
SELECT 1;`;

describe('SqlFormatter CTE comma break style', () => {
    test('formats CTE commas before when cteCommaBreak is "before"', () => {
        const query = SelectQueryParser.parse(sqlWithTwoCtes);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            commaBreak: 'after',
            cteCommaBreak: 'before',
        });

        const expectedSql = `with
  "cte1" as (
    select
      1
  )
  , "cte2" as (
    select
      2
  )
select
  1`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });

    test('formats CTE commas after when overriding global "before" style', () => {
        const query = SelectQueryParser.parse(sqlWithTwoCtes);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            commaBreak: 'before',
            cteCommaBreak: 'after',
        });

        const expectedSql = `with
  "cte1" as (
    select
      1
  ),
  "cte2" as (
    select
      2
  )
select
  1`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });

    test('keeps full-oneline formatting with custom CTE comma break', () => {
        const query = SelectQueryParser.parse(sqlWithTwoCtes);
        const formatter = new SqlFormatter({
            newline: ' ',
            cteCommaBreak: 'before',
            withClauseStyle: 'full-oneline',
        });

        const expectedSql = 'with "cte1" as (select 1), "cte2" as (select 2) select 1';

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });
});

