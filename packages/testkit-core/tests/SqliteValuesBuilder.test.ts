import { describe, expect, it } from 'vitest';
import { SqliteValuesBuilder } from '../src/sql/SqliteValuesBuilder';
import type { NormalizedFixture } from '../src/fixtures/FixtureStore';

const baseColumns: NormalizedFixture['columns'] = [
  { name: 'id', affinity: 'INTEGER' },
  { name: 'name', affinity: 'TEXT' },
];

const createFixture = (rows: NormalizedFixture['rows']): NormalizedFixture => ({
  name: 'users',
  columns: baseColumns,
  rows,
});

describe('SqliteValuesBuilder.buildCTE', () => {
  it('guards empty fixtures by emitting WHERE 1 = 0', () => {
    // Arrange fixture with zero rows to trigger the empty guard branch.
    const fixture = createFixture([]);

    // Act by building the CTE SQL text.
    const cte = SqliteValuesBuilder.buildCTE(fixture);

    // Assert the SELECT projects NULLs and filters all rows.
    expect(cte.inlineSql).toContain('WHERE 1 = 0');
    expect(cte.inlineSql).toContain('CAST(NULL AS INTEGER) AS "id"');
    expect(cte.inlineSql).toContain('CAST(NULL AS TEXT) AS "name"');
  });

  it('produces deterministic inline SQL for empty fixtures', () => {
    // Arrange fixture without rows to compare the inline SQL snapshot.
    const fixture = createFixture([]);

    // Act by generating the inline SQL through the builder.
    const cte = SqliteValuesBuilder.buildCTE(fixture);

    // Assert the exact SQL string includes the WHERE guard and indentation.
    const expectedSql = `"users" AS (
  SELECT CAST(NULL AS INTEGER) AS "id", CAST(NULL AS TEXT) AS "name" WHERE 1 = 0
)`;
    expect(cte.inlineSql).toBe(expectedSql);
  });

  it('emits a single SELECT when there is exactly one row', () => {
    // Arrange fixture with one row to cover the singleton branch.
    const fixture = createFixture([[1, 'Alice']]);

    // Act by building the CTE SQL text.
    const cte = SqliteValuesBuilder.buildCTE(fixture);

    // Assert no guard WHERE clause or UNION markers appear.
    expect(cte.inlineSql).not.toContain('WHERE 1 = 0');
    expect(cte.inlineSql).not.toContain('UNION ALL');
    expect(cte.inlineSql).toContain('CAST(1 AS INTEGER) AS "id"');
    expect(cte.inlineSql).toContain("CAST('Alice' AS TEXT) AS \"name\"");
  });

  it('joins multiple SELECT statements with UNION ALL when needed', () => {
    // Arrange fixture with multiple rows to exercise the UNION branch.
    const fixture = createFixture([
      [1, 'Alice'],
      [2, 'Bob'],
    ]);

    // Act by building the CTE SQL text.
    const cte = SqliteValuesBuilder.buildCTE(fixture);

    // Assert UNION ALL appears between two SELECT projections.
    const selectCount = (cte.inlineSql.match(/SELECT/g) ?? []).length;
    expect(cte.inlineSql).toContain('UNION ALL');
    expect(selectCount).toBe(2);
  });

  it('emits the full inline SQL text for manual inspection', () => {
    // Arrange deterministic fixture to compare the entire inline SQL definition.
    const fixture = createFixture([
      [1, 'Alice'],
      [2, 'Bob'],
    ]);

    // Act by materializing the CTE definition.
    const cte = SqliteValuesBuilder.buildCTE(fixture);

    // Assert the inline SQL matches the exact expected formatting.
    const expectedSql = `"users" AS (
  SELECT CAST(1 AS INTEGER) AS "id", CAST('Alice' AS TEXT) AS "name"
  UNION ALL
  SELECT CAST(2 AS INTEGER) AS "id", CAST('Bob' AS TEXT) AS "name"
)`;
    expect(cte.inlineSql).toBe(expectedSql);
  });
});
