import { describe, test, expect } from 'vitest';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('SqlFormatter grouping sets comments', () => {
    test('keeps comments adjacent to grouping set entries', () => {
        const rawSql = `
SELECT
  region,
  product,
  SUM(amount)
FROM sales
GROUP BY GROUPING SETS (
  (region, product),   -- comment1
  (region),            -- comment2
  ()                   -- comment3
);
`;
        const formatter = new SqlFormatter({ exportComment: true });
        const formatted = formatter.format(SelectQueryParser.parse(rawSql)).formattedSql;
        expect(formatted).toBe('select "region", "product", sum("amount") from "sales" group by grouping sets(("region", "product") /* comment1 */ , ("region") /* comment2 */ , () /* comment3 */ )');
    });
});
