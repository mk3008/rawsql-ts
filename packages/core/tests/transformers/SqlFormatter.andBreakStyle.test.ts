import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter andBreak option', () => {
    const sql = `SELECT
    *
FROM sales s
WHERE s.sale_date >= '2023-01-01' /* Period start */
  AND s.sale_date < '2024-01-01'
  AND s.quantity > 0;`;

    test('andBreak "before" places AND at the beginning of new lines even with trailing comments', () => {
        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
            andBreak: 'before',
            exportComment: true,
        });

        const expectedSql = `select
  *
from
  "sales" as "s"
where
  "s"."sale_date" >= '2023-01-01' /* Period start */
  and "s"."sale_date" < '2024-01-01'
  and "s"."quantity" > 0`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });

    test('andBreak "after" keeps AND at line end and breaks following condition', () => {
        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
            andBreak: 'after',
            exportComment: true,
        });

        const expectedSql = `select
  *
from
  "sales" as "s"
where
  "s"."sale_date" >= '2023-01-01' /* Period start */
  and
  "s"."sale_date" < '2024-01-01' and
  "s"."quantity" > 0`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });
});

