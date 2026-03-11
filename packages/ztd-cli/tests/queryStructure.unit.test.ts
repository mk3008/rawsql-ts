import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { buildQueryStructureReport, formatQueryStructureReport } from '../src/query/structure';

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

test('buildQueryStructureReport extracts CTE dependency relationships without executing SQL', () => {
  const workspace = createSqlWorkspace('query-structure-report', path.join('src', 'sql', 'reports', 'dependency_graph.sql'));
  writeFileSync(
    workspace.sqlFile,
    `
      with regional_users as (
        select u.id, u.region_id
        from public.users u
      ),
      active_regions as (
        select id
        from public.regions
        where active = true
      ),
      filtered_users as (
        select ru.id
        from regional_users ru
        join active_regions ar on ar.id = ru.region_id
      ),
      purchase_summary as (
        select o.user_id, count(*) as order_count
        from public.orders o
        join filtered_users fu on fu.id = o.user_id
        group by o.user_id
      ),
      orphaned_audit as (
        select * from public.audit_log
      )
      select *
      from purchase_summary
    `,
    'utf8'
  );

  const report = buildQueryStructureReport(workspace.sqlFile);

  expect(report).toMatchObject({
    query_type: 'SELECT',
    file: workspace.sqlFile,
    cte_count: 5,
    final_query: 'purchase_summary',
    unused_ctes: ['orphaned_audit']
  });
  expect(report.ctes).toEqual([
    {
      name: 'regional_users',
      depends_on: [],
      used_by_final_query: true,
      unused: false
    },
    {
      name: 'active_regions',
      depends_on: [],
      used_by_final_query: true,
      unused: false
    },
    {
      name: 'filtered_users',
      depends_on: ['active_regions', 'regional_users'],
      used_by_final_query: true,
      unused: false
    },
    {
      name: 'purchase_summary',
      depends_on: ['filtered_users'],
      used_by_final_query: true,
      unused: false
    },
    {
      name: 'orphaned_audit',
      depends_on: [],
      used_by_final_query: false,
      unused: true
    }
  ]);
  expect(report.referenced_tables).toEqual([
    'public.audit_log',
    'public.orders',
    'public.regions',
    'public.users'
  ]);
});

test('formatQueryStructureReport renders json for agents and text for humans', () => {
  const workspace = createSqlWorkspace('query-structure-format');
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

  const report = buildQueryStructureReport(workspace.sqlFile);

  // Keep the contract explicit for machine consumers that need stable fields.
  const jsonOutput = formatQueryStructureReport(report, 'json');
  expect(JSON.parse(jsonOutput)).toEqual(report);

  // Keep the text rendering readable when a developer inspects the graph manually.
  const textOutput = formatQueryStructureReport(report, 'text');
  expect(textOutput).toContain('Query type: SELECT');
  expect(textOutput).toContain('CTE count: 2');
  expect(textOutput).toContain('1. base_data');
  expect(textOutput).toContain('2. final_data');
  expect(textOutput).toContain('depends_on: base_data');
  expect(textOutput).toContain('Final query target:');
  expect(textOutput).toContain('final_data');
  expect(textOutput).toContain('Referenced tables:');
  expect(textOutput).toContain('public.users');
});

test('buildQueryStructureReport reports the caller command name on unsupported input', () => {
  const workspace = createSqlWorkspace('query-graph-unsupported');
  writeFileSync(workspace.sqlFile, 'create table public.users (id integer primary key)', 'utf8');

  expect(() => buildQueryStructureReport(workspace.sqlFile, 'ztd query graph')).toThrow(
    'ztd query graph supports SELECT/INSERT/UPDATE/DELETE statements only.'
  );
});
