import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter orBreak option', () => {
    const sql = `SELECT
    *
FROM sales
WHERE status = 'active'
  OR status = 'pending'
  OR status = 'paused'`;

    test('orBreak "before" places OR at beginning of new lines', () => {
        const query = SelectQueryParser.parse(sql);
        // Format with OR tokens leading each new line to verify break-before behavior.
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
            orBreak: 'before',
        });

        const expectedSql = `select
  *
from
  "sales"
where
  "status" = 'active'
  or "status" = 'pending'
  or "status" = 'paused'`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });

    test('orBreak "after" keeps OR at line end and breaks following condition', () => {
        const query = SelectQueryParser.parse(sql);
        // Place OR at the tail of each predicate to match break-after expectations.
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
            orBreak: 'after',
        });

        const expectedSql = `select
  *
from
  "sales"
where
  "status" = 'active' or
  "status" = 'pending' or
  "status" = 'paused'`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });

    test('orBreak "none" preserves compact OR chains', () => {
        const query = SelectQueryParser.parse(sql);
        // Confirm default compaction leaves OR operators inline when no break style is chosen.
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
            orBreak: 'none',
        });

        const expectedSql = `select
  *
from
  "sales"
where
  "status" = 'active' or "status" = 'pending' or "status" = 'paused'`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });
});
