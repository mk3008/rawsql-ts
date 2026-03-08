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

function writePipelineSql(sqlFile: string): void {
  writeFileSync(
    sqlFile,
    [
      'with base_users as (',
      '  select id, region_id from public.users where tenant_id = $1',
      '),',
      'eligible_users as (',
      '  select id from base_users where region_id is not null',
      '),',
      'ranked_users as (',
      '  select id, row_number() over (order by id) as user_rank from eligible_users',
      '),',
      'summary_total as (',
      '  select count(*) as total_count from ranked_users',
      '),',
      'final_rows as (',
      '  select ru.id, ru.user_rank, st.total_count',
      '  from ranked_users ru',
      '  cross join summary_total st',
      ')',
      'select * from final_rows'
    ].join('\n'),
    'utf8'
  );
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

test('executeQueryPipeline rewrites mixed material/scalar dependencies across a multi-stage pipeline', async () => {
  const workspace = createSqlWorkspace('query-pipeline-execute', path.join('src', 'sql', 'reports', 'pipeline.sql'));
  writePipelineSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [{ total_count: 2 }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [{ id: 1, user_rank: 1, total_count: 2 }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });
  const release = vi.fn();
  const openSession = vi.fn(async () => ({ query, release }));

  const result = await executeQueryPipeline(
    { openSession },
    {
      sqlFile: workspace.sqlFile,
      metadata: {
        material: ['eligible_users', 'ranked_users'],
        scalarMaterial: ['summary_total']
      },
      params: [42]
    }
  );

  expect(openSession).toHaveBeenCalledTimes(1);
  expect(query).toHaveBeenCalledTimes(6);
  expect(result.steps.map((step) => step.kind)).toEqual([
    'materialize',
    'materialize',
    'scalar-materialize',
    'final-query'
  ]);
  expect(result.scalarMaterials).toEqual({ summary_total: 2 });
  expect(result.final.rows).toEqual([{ id: 1, user_rank: 1, total_count: 2 }]);

  const materialStage1Sql = normalizeSql(query.mock.calls[0]?.[0] as string);
  const materialStage2Sql = normalizeSql(query.mock.calls[1]?.[0] as string);
  const scalarStageSql = normalizeSql(query.mock.calls[2]?.[0] as string);
  const finalStageSql = normalizeSql(query.mock.calls[3]?.[0] as string);

  expect(materialStage1Sql).toContain('create temp table "eligible_users" as with');
  expect(materialStage2Sql).toContain('create temp table "ranked_users" as with');
  expect(materialStage2Sql).not.toContain('eligible_users as (');
  expect(materialStage2Sql).toContain('from "eligible_users"');

  expect(scalarStageSql).not.toContain('eligible_users as (');
  expect(scalarStageSql).not.toContain('ranked_users as (');
  expect(scalarStageSql).toContain('\"summary_total\" as (select count(*) as \"total_count\" from \"ranked_users\")');

  expect(finalStageSql).not.toContain('eligible_users as (');
  expect(finalStageSql).not.toContain('ranked_users as (');
  expect(finalStageSql).not.toContain('select count(*) as "total_count" from "ranked_users"');
  expect(finalStageSql).toContain('"summary_total" as (select $1 as "total_count")');
  expect(query.mock.calls[3]?.[1]).toEqual([2]);

  expect(normalizeSql(query.mock.calls[4]?.[0] as string)).toBe('drop table if exists "ranked_users"');
  expect(normalizeSql(query.mock.calls[5]?.[0] as string)).toBe('drop table if exists "eligible_users"');
  expect(release).toHaveBeenCalledTimes(1);
});

test('executeQueryPipeline cleans up temp tables when a materialize step fails', async () => {
  const workspace = createSqlWorkspace('query-pipeline-material-failure');
  writePipelineSql(workspace.sqlFile);

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
          material: ['eligible_users', 'ranked_users']
        },
        params: [42]
      }
    )
  ).rejects.toThrow('material boom');

  expect(openSession).toHaveBeenCalledTimes(1);
  expect(normalizeSql(query.mock.calls[2]?.[0] as string)).toBe('drop table if exists "eligible_users"');
  expect(release).toHaveBeenCalledTimes(1);
});

test('executeQueryPipeline keeps dropping later temp tables after one cleanup failure', async () => {
  const workspace = createSqlWorkspace('query-pipeline-cleanup-continue');
  writePipelineSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [{ total_count: 2 }], rowCount: 1 })
    .mockRejectedValueOnce(new Error('final boom'))
    .mockRejectedValueOnce(new Error('drop ranked failed'))
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });
  const release = vi.fn();
  const openSession = vi.fn(async () => ({ query, release }));

  await expect(() =>
    executeQueryPipeline(
      { openSession },
      {
        sqlFile: workspace.sqlFile,
        metadata: {
          material: ['eligible_users', 'ranked_users'],
          scalarMaterial: ['summary_total']
        },
        params: [42]
      }
    )
  ).rejects.toThrow('final boom');

  expect(normalizeSql(query.mock.calls[4]?.[0] as string)).toBe('drop table if exists "ranked_users"');
  expect(normalizeSql(query.mock.calls[5]?.[0] as string)).toBe('drop table if exists "eligible_users"');
  expect(release).toHaveBeenCalledTimes(1);
});

test('executeQueryPipeline cleans up temp tables when the final query fails', async () => {
  const workspace = createSqlWorkspace('query-pipeline-final-failure');
  writePipelineSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [{ total_count: 2 }], rowCount: 1 })
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
          material: ['eligible_users', 'ranked_users'],
          scalarMaterial: ['summary_total']
        },
        params: [42]
      }
    )
  ).rejects.toThrow('final boom');

  expect(openSession).toHaveBeenCalledTimes(1);
  expect(normalizeSql(query.mock.calls[4]?.[0] as string)).toBe('drop table if exists "ranked_users"');
  expect(normalizeSql(query.mock.calls[5]?.[0] as string)).toBe('drop table if exists "eligible_users"');
  expect(release).toHaveBeenCalledTimes(1);
});

test('executeQueryPipeline falls back to session.end when release is unavailable', async () => {
  const workspace = createSqlWorkspace('query-pipeline-end-fallback');
  writePipelineSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });
  const end = vi.fn();
  const openSession = vi.fn(async () => ({ query, end }));

  await executeQueryPipeline(
    { openSession },
    {
      sqlFile: workspace.sqlFile,
      metadata: {
        material: ['eligible_users']
      },
      params: [42]
    }
  );

  expect(openSession).toHaveBeenCalledTimes(1);
  expect(end).toHaveBeenCalledTimes(1);
});

test.each([
  {
    label: '0 rows',
    rows: [],
    message: 'Scalar material "summary_total" must return exactly one row.'
  },
  {
    label: '2 rows',
    rows: [{ total_count: 1 }, { total_count: 2 }],
    message: 'Scalar material "summary_total" must return exactly one row.'
  },
  {
    label: '2 columns',
    rows: [{ total_count: 1, extra_value: 2 }],
    message: 'Scalar material "summary_total" must return exactly one column.'
  }
])('executeQueryPipeline rejects invalid scalar material results: $label', async ({ rows, message }) => {
  const workspace = createSqlWorkspace(`query-pipeline-invalid-scalar-${rows.length}`);
  writePipelineSql(workspace.sqlFile);

  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 2 })
    .mockResolvedValueOnce({ rows, rowCount: rows.length })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 });
  const release = vi.fn();
  const openSession = vi.fn(async () => ({ query, release }));

  await expect(() =>
    executeQueryPipeline(
      { openSession },
      {
        sqlFile: workspace.sqlFile,
        metadata: {
          material: ['eligible_users'],
          scalarMaterial: ['summary_total']
        },
        params: [42]
      }
    )
  ).rejects.toThrow(message);

  expect(openSession).toHaveBeenCalledTimes(1);
  expect(normalizeSql(query.mock.calls[2]?.[0] as string)).toBe('drop table if exists "eligible_users"');
  expect(release).toHaveBeenCalledTimes(1);
});
