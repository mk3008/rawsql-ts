import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { buildQueryLintReport, formatQueryLintReport } from '../src/query/lint';

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

test('buildQueryLintReport detects structural maintainability issues', () => {
  const workspace = createSqlWorkspace('query-lint-report', path.join('src', 'sql', 'reports', 'maintainability.sql'));
  const oversizedProjection = Array.from({ length: 120 }, (_, index) => `          id + ${index} as value_${index}`).join(',\n');
  writeFileSync(
    workspace.sqlFile,
    `
      with base_users as (
        select u.id, u.region_id
        from public.users u
        join public.regions r on r.id = u.region_id
        where u.active = true
      ),
      filtered_users as (
        select u.id, u.region_id
        from public.users u
        join public.regions r on r.id = u.region_id
        where u.active = true
      ),
      oversized_stage as (
        select
${oversizedProjection}
        from filtered_users
      ),
      unused_stage as (
        select * from public.audit_log
      )
      select format('select %s from users', id)
      from oversized_stage
    `,
    'utf8'
  );

  const report = buildQueryLintReport(workspace.sqlFile);

  expect(report).toMatchObject({
    file: workspace.sqlFile,
    query_type: 'SELECT',
    cte_count: 4
  });
  expect(report.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'unused-cte', cte: 'base_users', severity: 'warning' }),
    expect.objectContaining({ type: 'unused-cte', cte: 'unused_stage', severity: 'warning' }),
    expect.objectContaining({ type: 'duplicate-join-block', severity: 'warning' }),
    expect.objectContaining({ type: 'duplicate-filter-predicate', severity: 'warning' }),
    expect.objectContaining({ type: 'large-cte', cte: 'oversized_stage', severity: 'info' }),
    expect.objectContaining({ type: 'analysis-risk', risk_pattern: 'format-sql-construction', severity: 'warning' })
  ]));
});

test('buildQueryLintReport does not flag legal recursive CTEs as dependency cycles', () => {
  const workspace = createSqlWorkspace('query-lint-recursive');
  writeFileSync(
    workspace.sqlFile,
    `
      with recursive walk as (
        select id, parent_id
        from public.nodes
        where parent_id is null
        union all
        select n.id, n.parent_id
        from public.nodes n
        join walk w on w.id = n.parent_id
      )
      select * from walk
    `,
    'utf8'
  );

  const report = buildQueryLintReport(workspace.sqlFile);

  expect(report.issues.filter((issue) => issue.type === 'dependency-cycle')).toEqual([]);
});

test('buildQueryLintReport detects dependency cycles as errors', () => {
  const workspace = createSqlWorkspace('query-lint-cycle');
  writeFileSync(
    workspace.sqlFile,
    `
      with a as (
        select * from b
      ),
      b as (
        select * from a
      )
      select * from a
    `,
    'utf8'
  );

  const report = buildQueryLintReport(workspace.sqlFile);

  expect(report.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'dependency-cycle',
      severity: 'error',
      cycle: ['a', 'b', 'a'],
      message: 'invalid dependency cycle detected (a -> b -> a)'
    })
  ]));
});

test('formatQueryLintReport renders json for agents and compact text for humans', () => {
  const workspace = createSqlWorkspace('query-lint-format');
  writeFileSync(
    workspace.sqlFile,
    `
      with unused_stage as (
        select id from public.users
      )
      select 1
    `,
    'utf8'
  );

  const report = buildQueryLintReport(workspace.sqlFile);
  const jsonOutput = formatQueryLintReport(report, 'json');
  expect(JSON.parse(jsonOutput)).toEqual(report);

  const textOutput = formatQueryLintReport(report, 'text');
  expect(textOutput).toContain('WARN  unused-cte: unused_stage is defined but never used');
});
