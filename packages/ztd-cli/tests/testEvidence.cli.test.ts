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
    "    cases: [{ id: 'lists-users', title: 'lists users', input: { active: 1 }, expected: 'success', output: [{ id: 1 }], tags: ['normalization', 'ep'], focus: 'Ensures user listing behavior remains deterministic.' }]",
    '  }',
    '],',
    'sqlCatalogCases: [',
    '  {',
    "    id: 'sql.active-orders',",
    "    title: 'active orders',",
    "    definitionPath: 'src/specs/sql/activeOrders.catalog.ts',",
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

function createCapturingProgram(capture: { stdout: string[]; stderr: string[] }): Command {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => capture.stdout.push(str),
    writeErr: (str) => capture.stderr.push(str)
  });
  registerTestEvidenceCommand(program);
  return program;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectDefinitionLinkPathOrGithub(markdown: string, definitionPath: string): void {
  const escapedPath = escapeRegex(definitionPath);
  const pattern = new RegExp(
    `definition: \\[${escapedPath}\\]\\((?:\\.\\./${escapedPath}|https://github\\.com/[^\\s)]+/blob/[^\\s)]+/${escapedPath})\\)`
  );
  expect(markdown).toMatch(pattern);
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
    cases: [{
      id: 'lists-users',
      title: 'lists users',
      input: { active: 1 },
      expected: 'success',
      output: [{ id: 1 }],
      tags: ['normalization', 'ep'],
      focus: 'Ensures user listing behavior remains deterministic.'
    }]
  });
  const markdownFiles = readdirSync(outDir)
    .filter((name) => name.startsWith('test-specification.') && name.endsWith('.md'))
    .sort();
  expect(markdownFiles).toEqual([
    'test-specification.catalog.sql-active-orders.md',
    'test-specification.catalog.unit-users.md',
    'test-specification.index.md',
  ]);
  const markdown = markdownFiles
    .map((name) => readFileSync(path.join(outDir, name), 'utf8'))
    .join('\n');
  const indexMarkdown = readFileSync(path.join(outDir, 'test-specification.index.md'), 'utf8');
  const usersCatalogMarkdown = readFileSync(path.join(outDir, 'test-specification.catalog.unit-users.md'), 'utf8');
  const sqlCatalogMarkdown = readFileSync(path.join(outDir, 'test-specification.catalog.sql-active-orders.md'), 'utf8');
  expect(indexMarkdown).toContain('# Unit Test Index');
  expect(indexMarkdown).toContain('- catalogs: 2');
  expect(indexMarkdown).toContain('[unit.users](./test-specification.catalog.unit-users.md)');
  expect(indexMarkdown).toContain('[sql.active-orders](./test-specification.catalog.sql-active-orders.md)');
  expect(indexMarkdown).toContain('  - title: users');
  expect(indexMarkdown).toContain('  - title: active orders');
  expect(indexMarkdown).not.toContain('## Test Case Files');
  expect(usersCatalogMarkdown).toContain('- index: [Unit Test Index](./test-specification.index.md)');
  expect(sqlCatalogMarkdown).toContain('- index: [Unit Test Index](./test-specification.index.md)');
  expect(markdown).toContain('# unit.users Test Cases');
  expect(markdown).toContain('# sql.active-orders Test Cases');
  expect(markdown).toContain('- title: users');
  expect(markdown).toContain('- title: active orders');
  expect(markdown).toContain('- catalogs: 2');
  expect(markdown).toContain('- tests: 1');
  expect(markdown).toContain('- tests: 2');
  expect(markdown).toContain('## lists-users - lists users');
  expectDefinitionLinkPathOrGithub(markdown, 'tests/specs/users.catalog.ts');
  expectDefinitionLinkPathOrGithub(markdown, 'src/specs/sql/activeOrders.catalog.ts');
  expect(markdown).toContain('## baseline - baseline');
  expect(markdown).toContain('## inactive - inactive');
  expect(markdown).not.toContain('\n---\n');
  expect(markdown).toContain('### input');
  expect(markdown).toContain('### output');
  expect(markdown).not.toContain('## SQL Unit Tests');
  expect(markdown).not.toContain('## Function Unit Tests');
  expect(markdown).toContain('"active": 1');
  expect(markdown).toContain('```json');
  expect(markdown).not.toContain('select order_id from orders where active = @active');
});

test('CLI: evidence help documents scopeDir and legacy specsDir across evidence commands', async () => {
  for (const args of [
    ['evidence', '--help'],
    ['evidence', 'test-doc', '--help'],
    ['evidence', 'pr', '--help']
  ]) {
    const capture = { stdout: [] as string[], stderr: [] as string[] };
    const program = createCapturingProgram(capture);

    await expect(program.parseAsync(args, { from: 'user' })).rejects.toMatchObject({
      code: 'commander.helpDisplayed'
    });

    const help = capture.stdout.join('');
    expect(help).toContain('--scope-dir <path>');
    expect(help).toContain('Limit QuerySpec discovery to one feature, boundary');
    expect(help).toContain('subtree');
    expect(help).toContain('--specs-dir <path>');
    expect(help).toContain('Legacy override for a fixed SQL catalog specs');
    expect(help).toContain('directory');
  }
});

test('CLI: evidence accepts scopeDir from --json payload', async () => {
  const root = createWorkspace('evidence-cli-scope-json');
  const queryDir = path.join(root, 'src', 'features', 'users', 'queries', 'list-users');
  mkdirSync(queryDir, { recursive: true });
  writeFileSync(path.join(queryDir, 'list-users.sql'), 'SELECT id FROM users WHERE active = :active', 'utf8');
  writeFileSync(
    path.join(queryDir, 'queryspec.ts'),
    [
      "const listUsersSql = loadSqlResource(__dirname, 'list-users.sql');",
      "export const listUsersQuerySpec = { label: 'features.users.list-users', sql: listUsersSql };",
      ''
    ].join('\n'),
    'utf8'
  );

  process.env.ZTD_PROJECT_ROOT = root;
  const outDir = path.join(root, 'artifacts-scope');
  const program = createProgram();
  await program.parseAsync(
    [
      'evidence',
      '--json',
      JSON.stringify({
        mode: 'specification',
        format: 'json',
        outDir,
        scopeDir: path.join('src', 'features', 'users')
      })
    ],
    { from: 'user' }
  );

  expect(process.exitCode).toBe(0);
  const parsedJson = JSON.parse(readFileSync(path.join(outDir, 'test-specification.json'), 'utf8'));
  expect(parsedJson.summary).toMatchObject({ sqlCatalogCount: 1, specFilesScanned: 1 });
  expect(parsedJson.sqlCatalogs[0]).toMatchObject({
    id: 'features.users.list-users',
    specFile: 'src/features/users/queries/list-users/queryspec.ts'
  });
});

test('CLI: evidence summary-only writes compact artifacts', async () => {
  const root = createWorkspace('evidence-cli-summary');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'users.spec.json'),
    JSON.stringify({ id: 'orders.active-users.list', sqlFile: '../../sql/orders.active-users.list.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(path.join(root, 'src', 'sql', 'orders.active-users.list.sql'), 'select user_id from users', 'utf8');
  writeSpecModule(root);

  process.env.ZTD_PROJECT_ROOT = root;
  const outDir = path.join(root, 'artifacts-summary');
  const program = createProgram();
  await program.parseAsync(['evidence', '--mode', 'specification', '--format', 'both', '--out-dir', outDir, '--summary-only'], { from: 'user' });

  expect(process.exitCode).toBe(0);
  const parsedJson = JSON.parse(readFileSync(path.join(outDir, 'test-specification.json'), 'utf8'));
  expect(parsedJson).toMatchObject({
    display: { summaryOnly: true, truncated: true },
    sqlCatalogs: [],
    testCases: []
  });
  const markdownFiles = readdirSync(outDir)
    .filter((name) => name.startsWith('test-specification.') && name.endsWith('.md'))
    .sort();
  expect(markdownFiles).toEqual(['test-specification.summary.md']);
  const markdown = readFileSync(path.join(outDir, 'test-specification.summary.md'), 'utf8');
  expect(markdown).toContain('# Test Specification Summary');
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


test('CLI: evidence test-doc writes a human-readable markdown artifact', async () => {
  const root = createWorkspace('evidence-cli-test-doc');
  writeSpecModule(root);

  process.env.ZTD_PROJECT_ROOT = root;
  const outFile = path.join(root, 'artifacts', 'test-documentation.md');
  const program = createProgram();
  await program.parseAsync(['evidence', 'test-doc', '--out', outFile], { from: 'user' });

  expect(process.exitCode).toBe(0);
  const markdown = readFileSync(outFile, 'utf8');
  expect(markdown).toContain('# ZTD Test Documentation');
  expect(markdown).toContain('## unit.users - users');
  expect(markdown).toContain('- purpose: Ensures user listing behavior remains deterministic.');
  expect(markdown).toContain('## sql.active-orders - active orders');
  expect(markdown).toContain('- targetType: sql-catalog');
  expect(markdown).toContain('- execution: Execute the SQL catalog with the documented parameters against fixtures: users.');
  expectDefinitionLinkPathOrGithub(markdown, 'tests/specs/users.catalog.ts');
  expectDefinitionLinkPathOrGithub(markdown, 'src/specs/sql/activeOrders.catalog.ts');
});

