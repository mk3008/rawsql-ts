import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter indentNestedParentheses option', () => {
    const sql = `SELECT
    *
FROM sales
WHERE (a = 1 OR b = 2) AND ((c IS NULL) OR (d <= 10) OR (e >= 20));`;

    test('indentNestedParentheses true expands outer group when nested parentheses exist', () => {
        const query = SelectQueryParser.parse(sql);
        // Enable indentation to expand only the outer group while keeping inner checks compact.
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
            parenthesesOneLine: true,
            orBreak: 'before',
            indentNestedParentheses: true,
        });

        const expectedSql = `select
  *
from
  "sales"
where
  ("a" = 1 or "b" = 2) and (
    ("c" is null)
    or ("d" <= 10)
    or ("e" >= 20)
  )`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });

    test('indentNestedParentheses false keeps entire group on a single indentation level', () => {
        const query = SelectQueryParser.parse(sql);
        // Confirm default behavior keeps parentheses compact when indentation toggle is disabled.
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 2,
            indentChar: ' ',
            keywordCase: 'lower',
            parenthesesOneLine: true,
            orBreak: 'before',
            indentNestedParentheses: false,
        });

        const expectedSql = `select
  *
from
  "sales"
where
  ("a" = 1 or "b" = 2) and (("c" is null) or ("d" <= 10) or ("e" >= 20))`;

        const result = formatter.format(query);

        expect(result.formattedSql).toBe(expectedSql);
    });
});
