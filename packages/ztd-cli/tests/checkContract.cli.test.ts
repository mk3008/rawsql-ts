import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, expect, test } from 'vitest';
import { registerCheckContractCommand } from '../src/commands/checkContract';

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
  return root;
}

function createProgram(capture: { stdout: string[]; stderr: string[] }): Command {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => capture.stdout.push(str),
    writeErr: (str) => capture.stderr.push(str)
  });
  registerCheckContractCommand(program);
  return program;
}

test('CLI: check contract help documents RFBA scope discovery and legacy specsDir', async () => {
  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createProgram(capture);

  await expect(program.parseAsync(['check', 'contract', '--help'], { from: 'user' })).rejects.toMatchObject({
    code: 'commander.helpDisplayed'
  });

  const help = capture.stdout.join('');
  expect(help).toContain('--scope-dir <path>');
  expect(help).toContain('Limit QuerySpec discovery to one feature, boundary, or');
  expect(help).toContain('subtree');
  expect(help).toContain('--specs-dir <path>');
  expect(help).toContain('Legacy override for a fixed SQL catalog specs directory');
});

test('CLI: check contract writes json output and sets exitCode=0 on success', async () => {
  const workspace = createWorkspace('check-contract-cli-pass');
  writeFileSync(
    path.join(workspace, 'src', 'catalog', 'specs', 'ok.spec.json'),
    JSON.stringify(
      {
        id: 'users.list',
        sqlFile: '../../sql/users.list.sql',
        params: { shape: 'named', example: { status: 'active' } },
        output: { mapping: { columnMap: { userId: 'user_id' } } }
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(path.join(workspace, 'src', 'sql', 'users.list.sql'), 'select user_id from users where status = :status', 'utf8');

  process.env.ZTD_PROJECT_ROOT = workspace;
  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createProgram(capture);

  const outPath = path.join(workspace, 'artifacts', 'contract-check.json');
  await program.parseAsync(['check', 'contract', '--format', 'json', '--out', outPath], { from: 'user' });

  expect(process.exitCode).toBe(0);
  const output = JSON.parse(readFileSync(outPath, 'utf8'));
  expect(output).toMatchObject({ ok: true, filesChecked: 1, specsChecked: 1, violations: [] });
  expect(capture.stdout.join('')).toBe('');
  expect(capture.stderr.join('')).toBe('');
});

test('CLI: check contract prints violations and sets exitCode=1', async () => {
  const workspace = createWorkspace('check-contract-cli-violations');
  writeFileSync(
    path.join(workspace, 'src', 'catalog', 'specs', 'bad.spec.json'),
    JSON.stringify(
      {
        id: 'users.bad',
        sqlFile: '../../sql/missing.sql',
        params: { shape: 'named', example: [] }
      },
      null,
      2
    ),
    'utf8'
  );

  process.env.ZTD_PROJECT_ROOT = workspace;
  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createProgram(capture);
  const outPath = path.join(workspace, 'artifacts', 'contract-check.json');

  await program.parseAsync(['check', 'contract', '--format', 'json', '--out', outPath], { from: 'user' });

  expect(process.exitCode).toBe(1);
  const parsed = JSON.parse(readFileSync(outPath, 'utf8'));
  expect(parsed.violations.some((v: { rule: string }) => v.rule === 'unresolved-sql-file')).toBe(true);
  expect(parsed.violations.some((v: { rule: string }) => v.rule === 'params-shape-mismatch')).toBe(true);
});

test('CLI: check contract flags uncovered SQL assets in strict mode', async () => {
  const workspace = createWorkspace('check-contract-cli-uncovered-sql');
  writeFileSync(path.join(workspace, 'src', 'sql', 'orphan.sql'), 'select 1', 'utf8');

  process.env.ZTD_PROJECT_ROOT = workspace;
  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createProgram(capture);
  const outPath = path.join(workspace, 'artifacts', 'contract-check.json');

  await program.parseAsync(['check', 'contract', '--format', 'json', '--strict', '--out', outPath], { from: 'user' });

  expect(process.exitCode).toBe(1);
  const parsed = JSON.parse(readFileSync(outPath, 'utf8'));
  expect(parsed.ok).toBe(false);
  expect(parsed.violations.some((v: { rule: string }) => v.rule === 'uncovered-sql-file')).toBe(true);
});

test('CLI: check contract sets exitCode=2 for runtime/config errors', async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'check-contract-cli-error-'));
  process.env.ZTD_PROJECT_ROOT = workspace;
  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createProgram(capture);

  await program.parseAsync(['check', 'contract', '--scope-dir', 'missing-feature'], { from: 'user' });

  expect(process.exitCode).toBe(2);
});

test('CLI: check contract accepts --json payload options', async () => {
  const workspace = createWorkspace('check-contract-cli-json');
  writeFileSync(
    path.join(workspace, 'src', 'catalog', 'specs', 'ok.spec.json'),
    JSON.stringify(
      {
        id: 'users.list',
        sqlFile: '../../sql/users.list.sql',
        params: { shape: 'named', example: { status: 'active' } }
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(path.join(workspace, 'src', 'sql', 'users.list.sql'), 'select user_id from users where status = :status', 'utf8');

  process.env.ZTD_PROJECT_ROOT = workspace;
  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createProgram(capture);
  const outPath = path.join(workspace, 'artifacts', 'contract-check.json');

  await program.parseAsync(
    ['check', 'contract', '--json', JSON.stringify({ format: 'json', out: outPath, strict: true })],
    { from: 'user' }
  );

  expect(process.exitCode).toBe(0);
  const output = JSON.parse(readFileSync(outPath, 'utf8'));
  expect(output).toMatchObject({ ok: true, filesChecked: 1, specsChecked: 1, violations: [] });
  expect(capture.stdout.join('')).toBe('');
  expect(capture.stderr.join('')).toBe('');
});

test('CLI: check contract accepts scopeDir from --json payload', async () => {
  const workspace = createWorkspace('check-contract-cli-scope-json');
  const queryDir = path.join(workspace, 'src', 'features', 'users', 'queries', 'list-users');
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

  process.env.ZTD_PROJECT_ROOT = workspace;
  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = createProgram(capture);
  const outPath = path.join(workspace, 'artifacts', 'contract-check.json');

  await program.parseAsync(
    [
      'check',
      'contract',
      '--json',
      JSON.stringify({
        format: 'json',
        out: outPath,
        scopeDir: path.join('src', 'features', 'users')
      })
    ],
    { from: 'user' }
  );

  expect(process.exitCode).toBe(0);
  const output = JSON.parse(readFileSync(outPath, 'utf8'));
  expect(output).toMatchObject({ ok: true, filesChecked: 1, specsChecked: 1, violations: [] });
});
