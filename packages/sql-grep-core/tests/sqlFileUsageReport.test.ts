import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSqlFileUsageReport } from '../src';

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
