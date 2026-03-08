import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { buildQuerySliceReport } from '../src/query/slice';

function createSqlFile(prefix: string, sql: string): string {
  const workspace = mkdtempSync(path.join(tmpdir(), `${prefix}-`));
  const sqlFile = path.join(workspace, 'query.sql');
  writeFileSync(sqlFile, sql, 'utf8');
  return sqlFile;
}

test('buildQuerySliceReport emits the minimal dependency chain for a target CTE', () => {
  const sqlFile = createSqlFile(
    'query-slice-cte',
    `
      with users_base as (
        select id, region_id from public.users
      ),
      filtered_users as (
        select id from users_base where region_id = 1
      ),
      purchase_summary as (
        select fu.id, count(*) as order_count
        from filtered_users fu
        join public.orders o on o.user_id = fu.id
        group by fu.id
      ),
      final_projection as (
        select * from purchase_summary
      ),
      unused_cte as (
        select * from public.audit_log
      )
      select * from final_projection
    `
  );

  const result = buildQuerySliceReport(sqlFile, { cte: 'purchase_summary' });

  expect(result.mode).toBe('cte');
  expect(result.included_ctes).toEqual(['users_base', 'filtered_users', 'purchase_summary']);
  expect(result.sql).toContain('"users_base" as');
  expect(result.sql).toContain('"filtered_users" as');
  expect(result.sql).toContain('"purchase_summary" as');
  expect(result.sql).toContain('from "purchase_summary"');
  expect(result.sql).not.toContain('final_projection');
  expect(result.sql).not.toContain('unused_cte');
});

test('buildQuerySliceReport preserves the minimized final query', () => {
  const sqlFile = createSqlFile(
    'query-slice-final',
    `
      with base_data as (
        select id, status from public.users
      ),
      filtered_data as (
        select id from base_data where status = 'active'
      ),
      unused_data as (
        select id from public.audit_log
      )
      select id from filtered_data order by id
    `
  );

  const result = buildQuerySliceReport(sqlFile, { final: true });

  expect(result.mode).toBe('final');
  expect(result.included_ctes).toEqual(['base_data', 'filtered_data']);
  expect(result.sql).toContain('"base_data" as');
  expect(result.sql).toContain('"filtered_data" as');
  expect(result.sql).toContain('from "filtered_data"');
  expect(result.sql).not.toContain('unused_data');
});

test('buildQuerySliceReport applies LIMIT to target CTE slices', () => {
  const sqlFile = createSqlFile(
    'query-slice-limit',
    `
      with base_data as (
        select id from public.users
      ),
      target_data as (
        select id from base_data
      )
      select * from target_data
    `
  );

  const result = buildQuerySliceReport(sqlFile, { cte: 'target_data', limit: 25 });

  expect(result.included_ctes).toEqual(['base_data', 'target_data']);
  expect(result.sql).toContain('from "target_data"');
  expect(result.sql).toContain('limit 25');
});

test('buildQuerySliceReport supports DML final slices while removing unused CTEs', () => {
  const sqlFile = createSqlFile(
    'query-slice-insert-final',
    `
      with source_rows as (
        select id from public.users
      ),
      audit_rows as (
        select id from public.audit_log
      )
      insert into public.user_report (user_id)
      select id from source_rows
    `
  );

  const result = buildQuerySliceReport(sqlFile, { final: true });

  expect(result.mode).toBe('final');
  expect(result.included_ctes).toEqual(['source_rows']);
  expect(result.sql).toContain('"source_rows" as');
  expect(result.sql).toContain('insert into');
  expect(result.sql).toContain('"user_report"');
  expect(result.sql).not.toContain('audit_rows');
});
