import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, expect, test } from 'vitest';
import {
  registerTestEvidenceCommand,
  resolveTestEvidenceExitCode,
  TestEvidenceRuntimeError
} from '../src/commands/testEvidence';

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

function writeSpecModule(root: string): void {
  const source = [
    'module.exports = {',
    'testCaseCatalogs: [',
    '  {',
    "    id: 'unit.users',",
    "    title: 'users',",
    "    definitionPath: 'tests/specs/users.catalog.ts',",
    "    cases: [{ id: 'lists-users', title: 'lists users', input: { active: 1 }, output: [{ id: 1 }] }]",
    '  }',
    '],',
    'sqlCatalogCases: [',
    '  {',
    "    id: 'sql.active-orders',",
    "    title: 'active orders',",
    '    fixtures: [',
    "      { tableName: 'users', rows: [{ id: 1 }], schema: { columns: { id: 'INTEGER' } } }",
    '    ],',
    '    catalog: {',
    "      id: 'orders.active-users.list',",
    "      params: { shape: 'named', example: { active: 1, minTotal: 20, limit: 2 } },",
    "      output: { mapping: { columnMap: { orderId: 'order_id' } } },",
    "      sql: 'select order_id from orders where active = @active'",
    '    },',
    "    cases: [",
    "      { id: 'baseline', title: 'baseline', expected: [{ orderId: 10 }] },",
    "      { id: 'inactive', title: 'inactive', arrange: () => ({ active: 0 }), expected: [{ orderId: 12 }] }",
    "    ]",
    '  }',
    ']',
    '};',
    ''
  ].join('\n');
  writeFileSync(path.join(root, 'tests', 'specs', 'index.cjs'), source, 'utf8');
}

function createProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerTestEvidenceCommand(program);
  return program;
}

test('CLI: evidence writes json and markdown artifacts', async () => {
  const root = createWorkspace('evidence-cli-pass');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'orders.active-users.list', sqlFile: '../../sql/orders.active-users.list.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(root, 'src', 'sql', 'orders.active-users.list.sql'), 'select user_id from users', 'utf8');
  writeSpecModule(root);

  process.env.ZTD_PROJECT_ROOT = root;
  const outDir = path.join(root, 'artifacts');
  const program = createProgram();
  await program.parseAsync(['evidence', '--mode', 'specification', '--format', 'both', '--out-dir', outDir], { from: 'user' });

  expect(process.exitCode).toBe(0);
  const parsedJson = JSON.parse(readFileSync(path.join(outDir, 'test-specification.json'), 'utf8'));
  expect(parsedJson.summary).toMatchObject({ sqlCatalogCount: 1, sqlCaseCatalogCount: 1, testCaseCount: 1 });
  expect(parsedJson.testCases[0]).toMatchObject({ id: 'unit.users.lists-users', filePath: 'tests/specs/index' });
  expect(parsedJson.sqlCaseCatalogs[0]).toMatchObject({
    id: 'sql.active-orders',
    cases: [
      { id: 'baseline', params: { active: 1, limit: 2, minTotal: 20 }, expected: [{ orderId: 10 }] },
      { id: 'inactive', params: { active: 0, limit: 2, minTotal: 20 }, expected: [{ orderId: 12 }] }
    ]
  });
  expect(parsedJson.testCaseCatalogs[0]).toMatchObject({
    id: 'unit.users',
    definitionPath: 'tests/specs/users.catalog.ts',
    cases: [{ id: 'lists-users', title: 'lists users', input: { active: 1 }, output: [{ id: 1 }] }]
  });
  const markdownFiles = readdirSync(outDir)
    .filter((name) => name.startsWith('test-specification.') && name.endsWith('.md'))
    .sort();
  expect(markdownFiles).toEqual([
    'test-specification.index.md',
    'test-specification.tests__specs__users-catalog.md',
    'test-specification.unknown.md'
  ]);
  const markdown = markdownFiles
    .map((name) => readFileSync(path.join(outDir, name), 'utf8'))
    .join('\n');
  const indexMarkdown = readFileSync(path.join(outDir, 'test-specification.index.md'), 'utf8');
  const usersMarkdown = readFileSync(path.join(outDir, 'test-specification.tests__specs__users-catalog.md'), 'utf8');
  const unknownMarkdown = readFileSync(path.join(outDir, 'test-specification.unknown.md'), 'utf8');
  expect(indexMarkdown).toContain('# Unit Test Index');
  expect(indexMarkdown).toContain('[test-specification.tests__specs__users-catalog.md](./test-specification.tests__specs__users-catalog.md)');
  expect(indexMarkdown).toContain('[test-specification.unknown.md](./test-specification.unknown.md)');
  expect(usersMarkdown).toContain('- index: [Unit Test Index](./test-specification.index.md)');
  expect(unknownMarkdown).toContain('- index: [Unit Test Index](./test-specification.index.md)');
  expect(markdown).toContain('# users.catalog.ts');
  expect(markdown).toContain('# unknown');
  expect(markdown).toContain('- catalogs: 1');
  expect(markdown).toContain('- tests: 1');
  expect(markdown).toContain('- tests: 2');
  expect(markdown).toContain('## sql.active-orders - active orders');
  expect(markdown).toContain('## unit.users - users');
  expect(markdown).toContain("definition: [tests/specs/users.catalog.ts](../tests/specs/users.catalog.ts)");
  expect(markdown).toContain('### baseline - baseline');
  expect(markdown).toContain('### lists-users - lists users');
  expect(markdown).toContain('### inactive - inactive');
  expect(markdown).not.toContain('\n---\n');
  expect(markdown).toContain('#### input');
  expect(markdown).toContain('#### output');
  expect(markdown).not.toContain('## SQL Unit Tests');
  expect(markdown).not.toContain('## Function Unit Tests');
  expect(markdown).toContain('"active": 1');
  expect(markdown).toContain('```json');
  expect(markdown).not.toContain('select order_id from orders where active = @active');
});

test('CLI: evidence sets exitCode=2 for unsupported mode', async () => {
  const root = createWorkspace('evidence-cli-mode');
  process.env.ZTD_PROJECT_ROOT = root;
  const program = createProgram();

  await program.parseAsync(['evidence', '--mode', 'report'], { from: 'user' });
  expect(process.exitCode).toBe(2);
});

test('resolveTestEvidenceExitCode maps success and runtime failures', () => {
  expect(resolveTestEvidenceExitCode({ result: {
    schemaVersion: 1,
    mode: 'specification',
    summary: { sqlCatalogCount: 0, sqlCaseCatalogCount: 0, testCaseCount: 0, specFilesScanned: 0, testFilesScanned: 0 },
    sqlCatalogs: [],
    sqlCaseCatalogs: [],
    testCaseCatalogs: [],
    testCases: []
  } })).toBe(0);
  expect(resolveTestEvidenceExitCode({ error: new Error('x') })).toBe(1);
  expect(resolveTestEvidenceExitCode({ error: new TestEvidenceRuntimeError('bad config') })).toBe(2);
});

