import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter comment placement around WITH (smart style)', () => {
    test('keeps block comment after WITH keyword for first CTE', () => {
        const sql = `WITH
/*
  Raw Sales Data Preparation
  --------------------------
  Extracts and processes core sales transactions for the analysis period.
  Applies business rules:
  - Only valid sales (quantity > 0)
  - Date range: 2023-01-01 to 2024-01-01
  - Calculates net amount considering discounts
*/
raw_sales AS (
  SELECT 1
)
SELECT * FROM raw_sales;`;

        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 4,
            indentChar: ' ',
            exportComment: true,
            commentStyle: 'smart',
            withClauseStyle: 'standard',
            keywordCase: 'upper',
        });

        const { formattedSql } = formatter.format(query);
        const upperSql = formattedSql.toUpperCase();

        const withIndex = upperSql.indexOf('WITH');
        const commentIndex = upperSql.indexOf('RAW SALES DATA PREPARATION');

        expect(withIndex).toBeGreaterThanOrEqual(0);
        expect(commentIndex).toBeGreaterThanOrEqual(0);
        expect(withIndex).toBeLessThan(commentIndex);
    });

    test('merges separator lines into a single smart comment block', () => {
        const sql = `WITH
/*
  Raw Sales Data Preparation
  --------------------------
  Extracts and processes core sales transactions for the analysis period.
  Applies business rules:
  - Only valid sales (quantity > 0)
  - Date range: 2023-01-01 to 2024-01-01
  - Calculates net amount considering discounts
*/
raw_sales AS (
  SELECT 1
)
SELECT * FROM raw_sales;`;

        const query = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter({
            newline: '\n',
            indentSize: 4,
            indentChar: ' ',
            exportComment: true,
            commentStyle: 'smart',
            withClauseStyle: 'standard',
        });

        const { formattedSql } = formatter.format(query);

        const expectedBlock = [
            '    /*',
            '      Raw Sales Data Preparation',
            '      --------------------------',
            '      Extracts and processes core sales transactions for the analysis period.',
            '      Applies business rules:',
            '      - Only valid sales (quantity > 0)',
            '      - Date range: 2023-01-01 to 2024-01-01',
            '      - Calculates net amount considering discounts',
            '    */',
        ].join('\n');

        expect(formattedSql).toContain(expectedBlock);
        expect(formattedSql).not.toContain('/* Raw Sales Data Preparation */');
    });
});
