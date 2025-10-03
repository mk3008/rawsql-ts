import { describe, expect, it } from 'vitest';
import { CTEComposer } from '../../src/transformers/CTEComposer';

describe('CTEComposer.removeWithClauses', () => {
  it('removes leading WITH clause while preserving existing formatting and comments', () => {
    const sql = `-- header comment
WITH data AS (
    SELECT *
    FROM source
)
SELECT *
FROM data
WHERE id = 1;`;

    const composer = new CTEComposer();
    const result = composer.removeWithClauses(sql);

    expect(result).toBe(`-- header comment
SELECT *
FROM data
WHERE id = 1;`);
  });

  it('returns original SQL when no WITH clause is present', () => {
    const sql = 'SELECT * FROM customers;';

    const composer = new CTEComposer();
    const result = composer.removeWithClauses(sql);

    expect(result).toBe(sql);
  });

  it('removes WITH clause that is preceded only by whitespace', () => {
    const sql = `
   
WITH temporary AS (SELECT 1)
SELECT * FROM temporary;`;

    const composer = new CTEComposer();
    const result = composer.removeWithClauses(sql);

    expect(result.startsWith('SELECT')).toBe(true);
  });
});
