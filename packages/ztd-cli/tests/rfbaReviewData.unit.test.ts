import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { expect, test } from 'vitest';
import { inspectRfbaBoundaries, registerRfbaCommand } from '../src/commands/rfba';
import {
  buildChangedBoundarySummary,
  buildVerificationSummary,
  classifyRfbaChangedFile,
  diffDdlTables,
  parseGitNameStatus,
  summarizeSqlChange,
} from '../src/commands/rfbaReviewData';
import { setAgentOutputFormat } from '../src/utils/agentCli';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

function writeWorkspaceFile(root: string, relativePath: string, contents = ''): void {
  const filePath = path.join(root, ...relativePath.split('/'));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, 'utf8');
}

function runGit(cwd: string, args: string[]): void {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  expect(result.status, result.stderr || result.stdout).toBe(0);
}

test('parseGitNameStatus supports added, modified, deleted, renamed, and copied entries', () => {
  expect(parseGitNameStatus([
    'A\tsrc/features/users/boundary.ts',
    'M\tdb/ddl/public.sql',
    'D\tsrc/features/users/tests/users.test.ts',
    'R091\told.sql\tnew.sql',
    'C100\ta.sql\tb.sql',
  ].join('\n'))).toEqual([
    { status: 'added', path: 'src/features/users/boundary.ts' },
    { status: 'modified', path: 'db/ddl/public.sql' },
    { status: 'deleted', path: 'src/features/users/tests/users.test.ts' },
    { status: 'renamed', oldPath: 'old.sql', path: 'new.sql', score: 91 },
    { status: 'copied', oldPath: 'a.sql', path: 'b.sql', score: 100 },
  ]);
});

test('classifyRfbaChangedFile maps RFBA review kinds and weights deterministically', () => {
  expect(classifyRfbaChangedFile({ status: 'modified', path: 'db/ddl/public.sql' })).toMatchObject({
    kind: 'ddl',
    boundary: null,
    reviewWeight: 'high',
  });
  expect(classifyRfbaChangedFile({ status: 'modified', path: 'src/features/users-insert/queries/insert-users/insert-users.sql' })).toMatchObject({
    kind: 'query-sql',
    boundary: 'src/features/users-insert/queries/insert-users',
    parentFeatureBoundary: 'src/features/users-insert',
    reviewWeight: 'high',
  });
  expect(classifyRfbaChangedFile({ status: 'modified', path: 'src/features/users-insert/queries/insert-users/tests/generated/analysis.json' })).toMatchObject({
    kind: 'generated-evidence',
    reviewWeight: 'low',
  });
  expect(classifyRfbaChangedFile({ status: 'modified', path: 'docs/notes.md' })).toMatchObject({
    kind: 'unknown',
    reviewWeight: 'medium',
  });
});

test('buildChangedBoundarySummary reuses RFBA inspection boundaries', () => {
  const workspace = createTempDir('rfba-review-boundaries');
  writeWorkspaceFile(workspace, 'src/features/users-insert/boundary.ts', 'export {};\n');
  writeWorkspaceFile(workspace, 'src/features/users-insert/queries/insert-users/boundary.ts', 'export {};\n');
  writeWorkspaceFile(workspace, 'src/features/users-insert/queries/insert-users/insert-users.sql', 'select 1;\n');
  const changedFiles = [
    classifyRfbaChangedFile({ status: 'modified', path: 'src/features/users-insert/queries/insert-users/insert-users.sql' }),
    classifyRfbaChangedFile({ status: 'modified', path: 'src/features/users-insert/queries/insert-users/boundary.ts' }),
  ];

  expect(buildChangedBoundarySummary(changedFiles, inspectRfbaBoundaries(workspace))).toEqual([
    {
      boundary: 'src/features/users-insert/queries/insert-users',
      kind: 'sub-boundary',
      parentBoundary: 'src/features/users-insert/queries',
      changedFiles: [
        'src/features/users-insert/queries/insert-users/boundary.ts',
        'src/features/users-insert/queries/insert-users/insert-users.sql',
      ],
      reviewWeight: 'high',
    },
  ]);
});

test('diffDdlTables reports add column, type, nullability, default, and explanation-only SQL', () => {
  const before = `
    CREATE TABLE public.users (
      id integer PRIMARY KEY,
      email text NOT NULL
    );
  `;
  const after = `
    CREATE TABLE public.users (
      id integer PRIMARY KEY,
      email varchar(320),
      status text NOT NULL DEFAULT 'active'
    );
  `;

  const changes = diffDdlTables(before, after, 'db/ddl/public.sql');

  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({
    object: 'public.users',
    explanationSqlPurpose: 'human-readable explanation only; not an auto-apply migration',
  });
  expect(changes[0].changes.map((change) => change.kind)).toEqual([
    'modify-column-type',
    'modify-column-nullability',
    'add-column',
  ]);
  expect(changes[0].tableViewAfter?.columnsAfter.map((column) => column.name)).toEqual(['email', 'id', 'status']);
});

test('diffDdlTables reports add-index and drop-index changes', () => {
  const before = `
    CREATE TABLE public.users (
      id integer PRIMARY KEY,
      email text NOT NULL
    );
    CREATE INDEX users_email_idx ON public.users (email);
  `;
  const after = `
    CREATE TABLE public.users (
      id integer PRIMARY KEY,
      email text NOT NULL
    );
    CREATE UNIQUE INDEX users_email_unique_idx ON public.users (email);
  `;

  expect(diffDdlTables(before, after, 'db/ddl/public.sql')).toEqual(expect.arrayContaining([
    expect.objectContaining({
      objectKind: 'index',
      object: 'users_email_idx',
      changes: [expect.objectContaining({ kind: 'drop-index' })],
    }),
    expect.objectContaining({
      objectKind: 'index',
      object: 'users_email_unique_idx',
      changes: [expect.objectContaining({ kind: 'add-index' })],
    }),
  ]));
});

test('summarizeSqlChange reports INSERT RETURNING and table usage changes', () => {
  const before = `INSERT INTO public.users (email) VALUES ($1) RETURNING id, email;`;
  const after = `INSERT INTO public.users (email, status) VALUES ($1, $2) RETURNING id, email, status;`;

  expect(summarizeSqlChange(before, after, 'src/features/users-insert/queries/insert-users/insert-users.sql', 'src/features/users-insert/queries/insert-users')).toMatchObject({
    statementKindBefore: 'insert',
    statementKindAfter: 'insert',
    writeTablesBefore: ['public.users'],
    writeTablesAfter: ['public.users'],
    returningColumnsBefore: ['email', 'id'],
    returningColumnsAfter: ['email', 'id', 'status'],
    reviewHints: expect.arrayContaining([
      'Confirm whether the returned result shape change is reflected in the query boundary.',
      'Confirm whether query-local cases assert the returned columns.',
    ]),
  });

  expect(summarizeSqlChange(
    `SELECT id, email FROM public.users WHERE email = $1;`,
    `SELECT id, email FROM public.users JOIN public.accounts ON accounts.user_id = users.id WHERE email = $1;`
  )).toMatchObject({
    readTablesAfter: ['public.accounts', 'public.users'],
    joinTablesAfter: ['public.accounts'],
    selectedColumnsAfter: ['email', 'id'],
    whereColumnsAfter: ['email'],
  });

  expect(summarizeSqlChange(
    `UPDATE public.users SET email = $1 WHERE id = $2 RETURNING id;`,
    `UPDATE public.user_profiles SET email = $1 WHERE id = $2 RETURNING id;`
  )).toMatchObject({
    writeTablesBefore: ['public.users'],
    writeTablesAfter: ['public.user_profiles'],
  });
});

test('buildVerificationSummary groups query evidence and flags likely missing evidence', () => {
  const files = [
    classifyRfbaChangedFile({ status: 'modified', path: 'src/features/users-insert/queries/insert-users/insert-users.sql' }),
    classifyRfbaChangedFile({ status: 'modified', path: 'src/features/users-insert/queries/insert-users/tests/generated/analysis.json' }),
    classifyRfbaChangedFile({ status: 'modified', path: 'src/features/users-insert/queries/insert-users/tests/cases/basic.case.ts' }),
    classifyRfbaChangedFile({ status: 'modified', path: 'tests/support/ztd/runner.ts' }),
  ];

  expect(buildVerificationSummary(files)).toEqual([
    {
      boundary: 'global',
      changedCases: [],
      changedGeneratedEvidence: [],
      changedEntrypoints: [],
      changedFeatureTests: [],
      changedTestSupport: ['tests/support/ztd/runner.ts'],
      missingLikelyEvidence: [],
    },
    {
      boundary: 'src/features/users-insert/queries/insert-users',
      changedCases: ['src/features/users-insert/queries/insert-users/tests/cases/basic.case.ts'],
      changedGeneratedEvidence: ['src/features/users-insert/queries/insert-users/tests/generated/analysis.json'],
      changedEntrypoints: [],
      changedFeatureTests: [],
      changedTestSupport: [],
      missingLikelyEvidence: [],
    },
  ]);

  expect(buildVerificationSummary([
    classifyRfbaChangedFile({ status: 'modified', path: 'src/features/users-insert/queries/insert-users/insert-users.sql' }),
  ])[0].missingLikelyEvidence).toEqual(['SQL changed but no query-local cases or generated evidence changed.']);
});

test('rfba review-data command emits stdout JSON and writes --out in a Git workspace', async () => {
  setAgentOutputFormat('text');
  const workspace = createTempDir('rfba-review-cli');
  runGit(workspace, ['init']);
  runGit(workspace, ['config', 'user.email', 'test@example.com']);
  runGit(workspace, ['config', 'user.name', 'Test User']);
  writeWorkspaceFile(workspace, 'db/ddl/public.sql', `
    CREATE TABLE public.users (
      id integer PRIMARY KEY,
      email text NOT NULL
    );
  `);
  writeWorkspaceFile(workspace, 'src/features/users-insert/boundary.ts', 'export const createUser = () => undefined;\n');
  writeWorkspaceFile(workspace, 'src/features/users-insert/queries/insert-users/boundary.ts', 'export const insertUsers = () => undefined;\n');
  writeWorkspaceFile(workspace, 'src/features/users-insert/queries/insert-users/insert-users.sql', 'INSERT INTO public.users (email) VALUES ($1) RETURNING id, email;\n');
  runGit(workspace, ['add', '.']);
  runGit(workspace, ['commit', '-m', 'base']);
  runGit(workspace, ['branch', 'base']);

  writeWorkspaceFile(workspace, 'db/ddl/public.sql', `
    CREATE TABLE public.users (
      id integer PRIMARY KEY,
      email text NOT NULL,
      status text NOT NULL DEFAULT 'active'
    );
  `);
  writeWorkspaceFile(workspace, 'src/features/users-insert/queries/insert-users/insert-users.sql', 'INSERT INTO public.users (email, status) VALUES ($1, $2) RETURNING id, email, status;\n');
  runGit(workspace, ['add', '.']);
  runGit(workspace, ['commit', '-m', 'head']);

  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => capture.stdout.push(str),
    writeErr: (str) => capture.stderr.push(str),
  });
  registerRfbaCommand(program);
  const outFile = '.ztd/review/rfba-review-data.json';

  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    capture.stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    await program.parseAsync(['rfba', 'review-data', '--root', workspace, '--base', 'base', '--head', 'HEAD', '--out', outFile], { from: 'user' });
  } finally {
    process.stdout.write = originalWrite;
  }

  const stdoutJson = JSON.parse(capture.stdout.join(''));
  const fileJson = JSON.parse(readFileSync(path.join(workspace, outFile), 'utf8'));
  expect(stdoutJson).toEqual(fileJson);
  expect(stdoutJson).toMatchObject({
    schemaVersion: 1,
    command: 'rfba review-data',
    base: 'base',
    head: 'HEAD',
    summary: {
      changedFiles: 2,
      changedBoundaries: 1,
      ddlChanges: 1,
      sqlChanges: 1,
    },
  });
  expect(stdoutJson.changedFiles.map((file: { kind: string }) => file.kind).sort()).toEqual(['ddl', 'query-sql']);
  expect(stdoutJson.warnings).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'verification.possibly-missing' }),
  ]));
});

test('rfba review-data help exposes review packet options', async () => {
  setAgentOutputFormat('text');
  const capture = { stdout: [] as string[], stderr: [] as string[] };
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => capture.stdout.push(str),
    writeErr: (str) => capture.stderr.push(str),
  });
  registerRfbaCommand(program);

  await expect(program.parseAsync(['rfba', 'review-data', '--help'], { from: 'user' })).rejects.toMatchObject({
    code: 'commander.helpDisplayed',
  });
  const stdout = capture.stdout.join('');
  expect(stdout).toContain('Generate deterministic RFBA review packet data from a Git diff');
  expect(stdout).toContain('--base <ref>');
  expect(stdout).toContain('--head <ref>');
  expect(stdout).toContain('--out <file>');
  expect(stdout).toContain('--scope <path>');
  expect(stdout).toContain('--include-raw-diff');
});
