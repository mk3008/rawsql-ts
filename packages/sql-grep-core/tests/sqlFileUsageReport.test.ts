import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildQueryUsageReport, buildSqlFileUsageReport } from '../src';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('buildSqlFileUsageReport', () => {
  it('recursively searches every SQL file beneath the selected directory without QuerySpec metadata', () => {
    const workspace = temporaryWorkspace();
    writeSql(workspace, 'queries/orders/list.sql', 'select order_id from public.orders');
    writeSql(workspace, 'queries/customers/list.SQL', 'select customer_id from public.customers');
    writeSql(workspace, 'queries/generated/copied.sql', 'select product_id from public.products');
    writeSql(workspace, 'archive/orders.sql', 'select order_id from public.orders');
    writeSql(workspace, 'queries/node_modules/ignored.sql', 'select order_id from public.orders');
    writeSql(workspace, 'queries/.git/ignored.sql', 'select order_id from public.orders');

    const report = buildSqlFileUsageReport({
      kind: 'table',
      rawTarget: 'public.orders',
      rootDir: workspace,
      scopeDir: 'queries',
      view: 'detail',
    });

    expect(report).toMatchObject({
      source: { kind: 'sql-files', scopeDir: 'queries' },
      summary: { catalogsScanned: 0, sqlFilesScanned: 3, statementsScanned: 3 },
    });
    expect(report.matches).toHaveLength(1);
    expect(report.matches[0]).toMatchObject({
      catalog_id: 'file:queries/orders/list.sql',
      sql_file: 'queries/orders/list.sql',
      usage_kind: 'from',
    });
  });

  it('rejects a scan directory that resolves outside the workspace', () => {
    const workspace = temporaryWorkspace();
    const outside = temporaryWorkspace();

    expect(() => buildSqlFileUsageReport({
      kind: 'table',
      rawTarget: 'public.orders',
      rootDir: workspace,
      scopeDir: path.relative(workspace, outside),
    })).toThrow('scopeDir must stay inside the configured workspace');
  });

  it('reports paths relative to the canonical workspace when rootDir is a junction', () => {
    const workspace = temporaryWorkspace();
    const linkParent = temporaryWorkspace();
    const workspaceLink = path.join(linkParent, 'workspace-link');
    symlinkSync(workspace, workspaceLink, 'junction');
    writeSql(workspace, 'queries/orders.sql', 'select order_id from public.orders');

    const report = buildSqlFileUsageReport({
      kind: 'table',
      rawTarget: 'public.orders',
      rootDir: workspaceLink,
      scopeDir: 'queries',
      view: 'detail',
    });

    expect(report.source).toEqual({ kind: 'sql-files', scopeDir: 'queries' });
    expect(report.matches[0]).toMatchObject({ sql_file: 'queries/orders.sql' });
  });

  it('returns an explicit partial report when the SQL file scan budget is exhausted', () => {
    const workspace = temporaryWorkspace();
    writeSql(workspace, 'queries/first.sql', 'select order_id from public.orders');
    writeSql(workspace, 'queries/second.sql', 'select order_id from public.orders');

    const fileLimited = buildSqlFileUsageReport({
      kind: 'table',
      rawTarget: 'public.orders',
      rootDir: workspace,
      scopeDir: 'queries',
      maxFiles: 1,
    });
    expect(fileLimited.summary.sqlFilesScanned).toBe(1);
    expect(fileLimited.warnings.map((warning) => warning.code)).toContain('sql-file-scan-limit');

    const byteLimited = buildSqlFileUsageReport({
      kind: 'table',
      rawTarget: 'public.orders',
      rootDir: workspace,
      scopeDir: 'queries',
      maxTotalBytes: 1,
    });
    expect(byteLimited.summary.sqlFilesScanned).toBe(0);
    expect(byteLimited.warnings.map((warning) => warning.code)).toContain('sql-file-byte-limit');
  });

  it('does not accept a directory where a QuerySpec SQL file is required', () => {
    const workspace = temporaryWorkspace();
    mkdirSync(path.join(workspace, 'query.sql'));
    writeFileSync(path.join(workspace, 'query-spec.json'), JSON.stringify({ id: 'directory-target', sqlFile: './query.sql' }));

    const report = buildQueryUsageReport({
      kind: 'table',
      rawTarget: 'public.orders',
      rootDir: workspace,
      specsDir: '.',
    });

    expect(report.summary.unresolvedSqlFiles).toBe(1);
    expect(report.warnings.map((warning) => warning.code)).toContain('unresolved-sql-file');
  });
});

function temporaryWorkspace(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'rawsql-sql-file-usage-'));
  temporaryDirectories.push(directory);
  return directory;
}

function writeSql(workspace: string, relativePath: string, sql: string): void {
  const filePath = path.resolve(workspace, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, sql);
}
