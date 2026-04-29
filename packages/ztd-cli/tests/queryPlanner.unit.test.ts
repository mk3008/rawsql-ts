import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { buildQueryPipelinePlan, formatQueryPipelinePlan } from '../src/query/planner';

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

test('buildQueryPipelinePlan emits deterministic ordered steps from metadata', () => {
  const workspace = createSqlWorkspace('query-pipeline-plan', path.join('src', 'sql', 'reports', 'pipeline.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with base_users as (
        select id, region_id
        from public.users
      ),
      filtered_users as (
        select id
        from base_users
        where region_id is not null
      ),
      ranked_users as (
        select id
        from filtered_users
      )
      select *
      from ranked_users
      where sale_date > (
        select p.closed_year_month
        from public.parameters p
      )
    `,
    'utf8'
  );

  const plan = buildQueryPipelinePlan(workspace.sqlFile, {
    material: ['ranked_users', 'filtered_users'],
    scalarFilterColumns: ['sale_date']
  });

  expect(plan).toMatchObject({
    file: workspace.sqlFile,
    query_type: 'SELECT',
    final_query: 'ranked_users',
    metadata: {
      material: ['ranked_users', 'filtered_users'],
      scalarFilterColumns: ['sale_date']
    }
  });
  expect(plan.steps).toEqual([
    {
      step: 1,
      kind: 'materialize',
      target: 'filtered_users',
      depends_on: ['base_users']
    },
    {
      step: 2,
      kind: 'materialize',
      target: 'ranked_users',
      depends_on: ['filtered_users']
    },
    {
      step: 3,
      kind: 'final-query',
      target: 'FINAL_QUERY',
      depends_on: ['ranked_users']
    }
  ]);
});

test('buildQueryPipelinePlan marks RETURNING CTE materialization steps explicitly', () => {
  const workspace = createSqlWorkspace('query-pipeline-returning-plan');
  writeFileSync(
    workspace.sqlFile,
    `
      with source_rows as (
        select id
        from pending_events
      ),
      inserted_rows as (
        insert into audit_log (id)
        select id
        from source_rows
        returning id
      )
      select *
      from inserted_rows
    `,
    'utf8'
  );

  const plan = buildQueryPipelinePlan(workspace.sqlFile, {
    material: ['inserted_rows']
  });

  expect(plan.steps).toEqual([
    {
      step: 1,
      kind: 'materialize-returning',
      target: 'inserted_rows',
      depends_on: ['source_rows']
    },
    {
      step: 2,
      kind: 'final-query',
      target: 'FINAL_QUERY',
      depends_on: ['inserted_rows']
    }
  ]);

  expect(formatQueryPipelinePlan(plan, 'text')).toContain('1. materialize returning inserted_rows');
});

test('buildQueryPipelinePlan keeps non-returning DML CTEs as normal materialize steps for execution fail-fast', () => {
  const workspace = createSqlWorkspace('query-pipeline-dml-no-returning-plan');
  writeFileSync(
    workspace.sqlFile,
    `
      with inserted_rows as (
        insert into audit_log (id)
        select id
        from pending_events
      )
      select 1
    `,
    'utf8'
  );

  const plan = buildQueryPipelinePlan(workspace.sqlFile, {
    material: ['inserted_rows']
  });

  expect(plan.steps[0]).toMatchObject({
    kind: 'materialize',
    target: 'inserted_rows'
  });
});

test('formatQueryPipelinePlan renders json for agents and text for humans', () => {
  const workspace = createSqlWorkspace('query-pipeline-format');
  writeFileSync(
    workspace.sqlFile,
    `
      with base_data as (
        select id
        from public.users
      ),
      final_data as (
        select id
        from base_data
      )
      select *
      from final_data
    `,
    'utf8'
  );

  const plan = buildQueryPipelinePlan(workspace.sqlFile, {
    material: ['final_data'],
    scalarFilterColumns: ['sale_date']
  });

  const jsonOutput = formatQueryPipelinePlan(plan, 'json');
  expect(JSON.parse(jsonOutput)).toEqual(plan);

  const textOutput = formatQueryPipelinePlan(plan, 'text');
  expect(textOutput).toContain('Query type: SELECT');
  expect(textOutput).toContain('Material CTEs: final_data');
  expect(textOutput).toContain('Scalar filter columns: sale_date');
  expect(textOutput).toContain('1. materialize final_data');
  expect(textOutput).toContain('2. run final query');
});

test('buildQueryPipelinePlan rejects metadata that references unknown CTE names', () => {
  const workspace = createSqlWorkspace('query-pipeline-invalid');
  writeFileSync(
    workspace.sqlFile,
    `
      with base_data as (
        select id
        from public.users
      )
      select *
      from base_data
    `,
    'utf8'
  );

  expect(() =>
    buildQueryPipelinePlan(workspace.sqlFile, {
      material: ['missing_cte']
    })
  ).toThrow('Unknown material CTE: missing_cte');
});
