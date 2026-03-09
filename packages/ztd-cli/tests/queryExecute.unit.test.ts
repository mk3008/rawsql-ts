import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, vi } from 'vitest';
import { executeQueryPipeline } from '../src/query/execute';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function createSqlWorkspace(prefix: string, sqlRelativePath: string = path.join('src', 'sql', 'query.sql')): {
  rootDir: string;
  sqlFile: string;
} {
  const rootDir = createTempDir(prefix);
  const sqlFile = path.join(rootDir, sqlRelativePath);
  mkdirSync(path.dirname(sqlFile), { recursive: true });
  return { rootDir, sqlFile };
}

function writeScalarPredicateSql(sqlFile: string): void {
  writeFileSync(
    sqlFile,
    [
      'select s.*',
      'from sales s',
      'where s.sale_date > (',
      '  select p.closed_year_month',
      '  from parameters p',
      ')'
    ].join('\n'),
    'utf8'
  );
}

function writeCorrelatedScalarPredicateSql(sqlFile: string): void {
  writeFileSync(
    sqlFile,
    [
      'select s.*',
      'from sales s',
      'where s.sale_date > (',
      '  select p.closed_year_month',
      '  from parameters p',
      '  where p.tenant_id = s.tenant_id',
      ')'
    ].join('\n'),
    'utf8'
  );
}

function writeMaterialChainSql(sqlFile: string): void {
  writeFileSync(
    sqlFile,
    [
      'with base_sales as (',
      '  select id, sale_date, region_id from sales',
      '),',
      'filtered_sales as (',
      '  select id, sale_date from base_sales where region_id is not null',
      '),',
      'ranked_sales as (',
      '  select id, sale_date from filtered_sales',
      ')',
      'select * from ranked_sales'
    ].join('\n'),
    'utf8'
  );
}

function writeMixedPipelineSql(sqlFile: string): void {
  writeFileSync(
    sqlFile,
    [
      'with scoped_sales as (',
      '  select s.id, s.sale_date, s.region_id',
      '  from sales s',
      '  where s.region_id is not null',
      '),',
      'ranked_sales as (',
      '  select ss.id, ss.sale_date',
      '  from scoped_sales ss',
      '  where ss.sale_date > (',
      '    select p.closed_year_month',
      '    from parameters p',
      '  )',
      ')',
      'select * from ranked_sales'
    ].join('\n'),
    'utf8'
  );
}

function writeInvalidStaticScalarSql(sqlFile: string): void {
  writeFileSync(
    sqlFile,
    [
      'select s.*',
      'from sales s',
      'where s.sale_date > (',
      '  select p.closed_year_month, p.closed_year',
      '  from parameters p',
      ')'
    ].join('\n'),
    'utf8'
  );
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

test('executeQueryPipeline rewrites optimizer-sensitive scalar predicates into bind parameters', async () => {
  const workspace = createSqlWorkspace('query-pipeline-scalar-bind');
  writeScalarPredicateSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ closed_year_month: '2024-12-01' }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
  const release = vi.fn();
  const openSession = vi.fn(async () => ({ query, release }));

  const result = await executeQueryPipeline(
    { openSession },
    {
      sqlFile: workspace.sqlFile,
      metadata: {
        scalarFilterColumns: ['sale_date']
      }
    }
  );

  expect(openSession).toHaveBeenCalledTimes(1);
  expect(result.steps.map((step) => step.kind)).toEqual(['scalar-filter-bind', 'final-query']);
  expect(result.final.rows).toEqual([{ id: 1 }]);

  const scalarSql = normalizeSql(query.mock.calls[0]?.[0] as string);
  const finalSql = normalizeSql(query.mock.calls[1]?.[0] as string);

  expect(scalarSql).toContain('select "p"."closed_year_month" from "parameters" as "p"');
  expect(finalSql).toMatch(/where "s"\."sale_date" > \$1/);
  expect(finalSql).not.toContain('select "p"."closed_year_month"');
  expect(query.mock.calls[1]?.[1]).toEqual(['2024-12-01']);
  expect(release).toHaveBeenCalledTimes(1);
});

test('executeQueryPipeline leaves correlated scalar predicates unchanged', async () => {
  const workspace = createSqlWorkspace('query-pipeline-correlated');
  writeCorrelatedScalarPredicateSql(workspace.sqlFile);

  const query = vi.fn().mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
  const release = vi.fn();
  const openSession = vi.fn(async () => ({ query, release }));

  const result = await executeQueryPipeline(
    { openSession },
    {
      sqlFile: workspace.sqlFile,
      metadata: {
        scalarFilterColumns: ['sale_date']
      }
    }
  );

  expect(result.steps.map((step) => step.kind)).toEqual(['final-query']);
  expect(query).toHaveBeenCalledTimes(1);
  const finalSql = normalizeSql(query.mock.calls[0]?.[0] as string);
  expect(finalSql).toContain('where "s"."sale_date" > (select "p"."closed_year_month" from "parameters" as "p" where "p"."tenant_id" = "s"."tenant_id")');
  expect(release).toHaveBeenCalledTimes(1);
});

test('executeQueryPipeline runs multi-stage materialized pipelines without recomputing prior CTEs', async () => {
  const workspace = createSqlWorkspace('query-pipeline-material-chain');
  writeMaterialChainSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [{ id: 1, sale_date: '2024-12-15' }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });
  const release = vi.fn();
  const openSession = vi.fn(async () => ({ query, release }));

  const result = await executeQueryPipeline(
    { openSession },
    {
      sqlFile: workspace.sqlFile,
      metadata: {
        material: ['filtered_sales', 'ranked_sales']
      }
    }
  );

  expect(result.steps.map((step) => step.kind)).toEqual(['materialize', 'materialize', 'final-query']);
  const stage1Sql = normalizeSql(query.mock.calls[0]?.[0] as string);
  const stage2Sql = normalizeSql(query.mock.calls[1]?.[0] as string);
  const finalSql = normalizeSql(query.mock.calls[2]?.[0] as string);

  expect(stage1Sql).toContain('create temp table "filtered_sales" as with');
  expect(stage2Sql).toContain('create temp table "ranked_sales" as with');
  expect(stage2Sql).not.toContain('filtered_sales as (');
  expect(stage2Sql).toContain('from "filtered_sales"');
  expect(finalSql).not.toContain('filtered_sales as (');
  expect(finalSql).not.toContain('ranked_sales as (');
  expect(finalSql).toContain('from "ranked_sales"');
  expect(normalizeSql(query.mock.calls[3]?.[0] as string)).toBe('drop table if exists "ranked_sales"');
  expect(normalizeSql(query.mock.calls[4]?.[0] as string)).toBe('drop table if exists "filtered_sales"');
  expect(release).toHaveBeenCalledTimes(1);
});

test('executeQueryPipeline mixes temp-table reuse with scalar predicate binding', async () => {
  const workspace = createSqlWorkspace('query-pipeline-mixed');
  writeMixedPipelineSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [{ closed_year_month: '2024-12-01' }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [{ id: 1, sale_date: '2024-12-15' }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });
  const release = vi.fn();
  const openSession = vi.fn(async () => ({ query, release }));

  const result = await executeQueryPipeline(
    { openSession },
    {
      sqlFile: workspace.sqlFile,
      metadata: {
        material: ['scoped_sales'],
        scalarFilterColumns: ['sale_date']
      }
    }
  );

  expect(result.steps.map((step) => step.kind)).toEqual(['materialize', 'scalar-filter-bind', 'final-query']);
  const finalSql = normalizeSql(query.mock.calls[2]?.[0] as string);
  expect(finalSql).toContain('from "scoped_sales" as "ss"');
  expect(finalSql).toMatch(/where "ss"\."sale_date" > \$1/);
  expect(finalSql).not.toContain('select "p"."closed_year_month"');
  expect(query.mock.calls[2]?.[1]).toEqual(['2024-12-01']);
  expect(normalizeSql(query.mock.calls[3]?.[0] as string)).toBe('drop table if exists "scoped_sales"');
  expect(release).toHaveBeenCalledTimes(1);
});

test('executeQueryPipeline cleans up temp tables when a materialize step fails', async () => {
  const workspace = createSqlWorkspace('query-pipeline-material-failure');
  writeMaterialChainSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockRejectedValueOnce(new Error('material boom'))
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });
  const release = vi.fn();
  const openSession = vi.fn(async () => ({ query, release }));

  await expect(() =>
    executeQueryPipeline(
      { openSession },
      {
        sqlFile: workspace.sqlFile,
        metadata: {
          material: ['filtered_sales', 'ranked_sales']
        }
      }
    )
  ).rejects.toThrow('material boom');

  expect(normalizeSql(query.mock.calls[2]?.[0] as string)).toBe('drop table if exists "filtered_sales"');
  expect(release).toHaveBeenCalledTimes(1);
});

test('executeQueryPipeline cleans up temp tables when the final query fails', async () => {
  const workspace = createSqlWorkspace('query-pipeline-final-failure');
  writeMaterialChainSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockRejectedValueOnce(new Error('final boom'))
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });
  const release = vi.fn();
  const openSession = vi.fn(async () => ({ query, release }));

  await expect(() =>
    executeQueryPipeline(
      { openSession },
      {
        sqlFile: workspace.sqlFile,
        metadata: {
          material: ['filtered_sales', 'ranked_sales']
        }
      }
    )
  ).rejects.toThrow('final boom');

  expect(normalizeSql(query.mock.calls[3]?.[0] as string)).toBe('drop table if exists "ranked_sales"');
  expect(normalizeSql(query.mock.calls[4]?.[0] as string)).toBe('drop table if exists "filtered_sales"');
  expect(release).toHaveBeenCalledTimes(1);
});

test('executeQueryPipeline falls back to session.end when release is unavailable', async () => {
  const workspace = createSqlWorkspace('query-pipeline-end-fallback');
  writeMaterialChainSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [{ id: 1, sale_date: '2024-12-15' }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });
  const end = vi.fn();
  const openSession = vi.fn(async () => ({ query, end }));

  await executeQueryPipeline(
    { openSession },
    {
      sqlFile: workspace.sqlFile,
      metadata: {
        material: ['filtered_sales']
      }
    }
  );

  expect(end).toHaveBeenCalledTimes(1);
});

test.each([
  {
    label: '0 rows',
    sqlFactory: writeScalarPredicateSql,
    results: [{ rows: [], rowCount: 0 }],
    message: 'Scalar filter binding for column "sale_date" must return exactly one row.'
  },
  {
    label: '2 rows',
    sqlFactory: writeScalarPredicateSql,
    results: [{ rows: [{ closed_year_month: '2024-12-01' }, { closed_year_month: '2024-12-02' }], rowCount: 2 }],
    message: 'Scalar filter binding for column "sale_date" must return exactly one row.'
  },
  {
    label: '2 columns',
    sqlFactory: writeInvalidStaticScalarSql,
    results: [],
    message: 'Scalar filter binding for column "sale_date" requires a subquery that statically exposes exactly one column.'
  }
])('executeQueryPipeline rejects invalid scalar filter bindings: $label', async ({ sqlFactory, results, message }) => {
  const workspace = createSqlWorkspace('query-pipeline-invalid-scalar');
  sqlFactory(workspace.sqlFile);

  const query = vi.fn();
  for (const result of results) {
    query.mockResolvedValueOnce(result);
  }
  const release = vi.fn();
  const openSession = vi.fn(async () => ({ query, release }));

  await expect(() =>
    executeQueryPipeline(
      { openSession },
      {
        sqlFile: workspace.sqlFile,
        metadata: {
          scalarFilterColumns: ['sale_date']
        }
      }
    )
  ).rejects.toThrow(message);

  expect(release).toHaveBeenCalledTimes(1);
});
