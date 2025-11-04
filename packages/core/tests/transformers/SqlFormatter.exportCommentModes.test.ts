import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const SAMPLE_SQL = `
-- ROOT HEADER
WITH data AS (
  -- CTE HEADER
  SELECT id
  FROM source_table
  -- BODY INLINE
)
SELECT id
FROM (
  -- SUBQUERY HEADER
  SELECT id
  FROM data
) sub
WHERE id > 0 -- TRAILING INLINE
`;

const parseSample = () => SelectQueryParser.parse(SAMPLE_SQL);

describe('SqlFormatter exportComment modes', () => {
    test('mode "full" matches legacy true option', () => {
        const formatterFull = new SqlFormatter({ exportComment: 'full' });
        const formatterLegacy = new SqlFormatter({ exportComment: true });

        const fullResult = formatterFull.format(parseSample());
        const legacyResult = formatterLegacy.format(parseSample());

        expect(fullResult.formattedSql).toBe(legacyResult.formattedSql);
    });

    test('mode "none" matches legacy false option', () => {
        const formatterNone = new SqlFormatter({ exportComment: 'none' });
        const formatterLegacy = new SqlFormatter({ exportComment: false });

        const noneResult = formatterNone.format(parseSample());
        const legacyResult = formatterLegacy.format(parseSample());

        expect(noneResult.formattedSql).toBe(legacyResult.formattedSql);
    });

    test('mode "header-only" emits only leading comments', () => {
        const { formattedSql } = new SqlFormatter({ exportComment: 'header-only' }).format(parseSample());

        // Header comments remain (top-level and CTE)
        expect(formattedSql).toContain('ROOT HEADER');
        expect(formattedSql).toContain('CTE HEADER');
        expect(formattedSql).not.toContain('SUBQUERY HEADER');

        // Inline comments are suppressed
        expect(formattedSql).not.toContain('BODY INLINE');
        expect(formattedSql).not.toContain('TRAILING INLINE');
    });

    test('mode "leaf-header-only" emits only top-level leading comments', () => {
        const { formattedSql } = new SqlFormatter({ exportComment: 'top-header-only' }).format(parseSample());

        expect(formattedSql).toContain('ROOT HEADER');
        expect(formattedSql).not.toContain('CTE HEADER');
        expect(formattedSql).not.toContain('SUBQUERY HEADER');
        expect(formattedSql).not.toContain('BODY INLINE');
        expect(formattedSql).not.toContain('TRAILING INLINE');
    });

    test('header-only hides non-header positioned comments', () => {
        const sql = `--1
SELECT
    --2
    id
FROM
    --3
    users`;
        const formatter = new SqlFormatter({ exportComment: 'header-only' });
        const { formattedSql } = formatter.format(SelectQueryParser.parse(sql));

        expect(formattedSql).toContain('1');
        expect(formattedSql).not.toContain('--2');
        expect(formattedSql).not.toContain('--3');
    });
});
