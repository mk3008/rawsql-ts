import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, expect, test } from 'vitest';
import { registerTestEvidenceCommand } from '../src/commands/testEvidence';

const originalProjectRoot = process.env.ZTD_PROJECT_ROOT;
const originalExitCode = process.exitCode;

afterEach(() => {
  process.env.ZTD_PROJECT_ROOT = originalProjectRoot;
  process.exitCode = originalExitCode;
});

function createWorkspace(prefix: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  mkdirSync(path.join(root, 'src', 'catalog', 'specs'), { recursive: true });
  mkdirSync(path.join(root, 'src', 'sql'), { recursive: true });
  mkdirSync(path.join(root, 'tests', 'specs'), { recursive: true });
  return root;
}

function writeDogfoodAssets(root: string): void {
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'orders.spec.json'),
    JSON.stringify(
      {
        id: 'orders.active-users.list',
        sqlFile: '../../sql/orders.active-users.list.sql',
        params: { shape: 'named', example: { active: 1, limit: 2 } },
      },
      null,
      2,
    ),
    'utf8',
  );
  writeFileSync(
    path.join(root, 'src', 'sql', 'orders.active-users.list.sql'),
    'select order_id from orders where active = @active order by order_id limit @limit',
    'utf8',
  );

  const specModule = [
    'module.exports = {',
    'testCaseCatalogs: [',
    '  {',
    "    id: 'unit.sales',",
    "    title: 'sales service',",
    "    definitionPath: 'tests/specs/sales.catalog.ts',",
    "    refs: [{ label: 'Issue #552', url: 'https://github.com/mk3008/rawsql-ts/pull/552' }],",
    '    cases: [',
    "      { id: 'happy-path', title: 'happy path', input: { customerId: 1 }, expected: 'success', output: [{ saleId: 10 }], tags: ['normalization', 'ep'], focus: 'Confirms the exported happy-path coverage for the current sales service.' }",
    '    ]',
    '  }',
    '],',
    'sqlCatalogCases: [',
    '  {',
    "    id: 'sql.active-orders',",
    "    title: 'active orders',",
    "    definitionPath: 'src/specs/sql/activeOrders.catalog.ts',",
    '    fixtures: [',
    "      { tableName: 'orders', rows: [{ order_id: 10, active: 1 }], schema: { columns: { order_id: 'INTEGER', active: 'INTEGER' } } }",
    '    ],',
    '    catalog: {',
    "      id: 'orders.active-users.list',",
    "      params: { shape: 'named', example: { active: 1, limit: 2 } },",
    "      output: { mapping: { columnMap: { orderId: 'order_id' } } },",
    "      sql: 'select order_id from orders where active = @active order by order_id limit @limit'",
    '    },',
    '    cases: [',
    "      { id: 'baseline', title: 'baseline', expected: [{ orderId: 10 }], refs: [{ label: 'Catalog note', url: 'https://example.invalid/catalog-note' }] }",
    '    ]',
    '  }',
    ']',
    '};',
    '',
  ].join('\n');

  writeFileSync(path.join(root, 'tests', 'specs', 'index.cjs'), specModule, 'utf8');
}

function createProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerTestEvidenceCommand(program);
  return program;
}

test('test documentation dogfood scenario preserves the shortest export loop artifact', async () => {
  const root = createWorkspace('evidence-test-doc-dogfood');
  writeDogfoodAssets(root);

  process.env.ZTD_PROJECT_ROOT = root;
  const outFile = path.join(root, 'artifacts', 'test-evidence', 'test-documentation.md');
  const program = createProgram();

  // Use the real CLI command path so the saved dogfood artifact matches maintainer usage.
  await program.parseAsync(['evidence', 'test-doc', '--out', outFile], { from: 'user' });

  expect(process.exitCode).toBe(0);
  const markdown = readFileSync(outFile, 'utf8');

  // Assert the exact sections that make the exported document actionable without opening source files.
  expect(markdown).toContain('# ZTD Test Documentation');
  expect(markdown).toContain('- catalogs: 2');
  expect(markdown).toContain('## sql.active-orders - active orders');
  expect(markdown).toContain('- targetType: sql-catalog');
  expect(markdown).toContain('- fixtures: orders');
  expect(markdown).toContain('### baseline - baseline');
  expect(markdown).toContain('#### Input / Setup');
  expect(markdown).toContain('#### Expected Result');
  expect(markdown).toContain('## unit.sales - sales service');
  expect(markdown).toContain('- purpose: Confirms the exported happy-path coverage for the current sales service.');
  expect(markdown).toContain('- coverage: normal; tags=[normalization, ep]');
  expect(markdown).toContain('[tests/specs/sales.catalog.ts]');
  expect(markdown).toContain('[src/specs/sql/activeOrders.catalog.ts]');
});
