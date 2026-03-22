import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, vi } from 'vitest';
import * as pgDumpUtil from '../src/utils/pgDump';
import { runDiffSchema } from '../src/commands/diff';

const repoRoot = path.resolve(__dirname, '../../..');
const tempRoot = path.join(repoRoot, 'tmp');

function readNormalizedFile(filePath: string): string {
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function createTempDir(prefix: string): string {
  if (!existsSync(tempRoot)) {
    mkdirSync(tempRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tempRoot, `${prefix}-`));
}

test('diff schema writes pure SQL plus companion review artifacts', () => {
  const ddlDir = path.join(createTempDir('cli-diff'), 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY,
        email text NOT NULL,
        last_login_at timestamptz
      );
    `,
    'utf8'
  );

  const outputFile = path.join(createTempDir('cli-diff-output'), 'users.diff.sql');
  const remoteSql = `
    CREATE TABLE public.users (
      id serial PRIMARY KEY,
      email text NOT NULL
    );
  `;

  // Replace pg_dump with a stable payload so the generated diff stays deterministic.
  const spy = vi.spyOn(pgDumpUtil, 'runPgDump').mockReturnValue(remoteSql);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));
  try {
    const result = runDiffSchema({
      directories: [ddlDir],
      extensions: ['.sql'],
      url: 'postgres://test:secret@cli-host:5432/diff-db',
      out: outputFile,
      connectionContext: {
        source: 'flags',
        host: 'cli-host',
        port: 5432,
        user: 'diff-user',
        database: 'diff-db'
      }
    });

    expect(spy).toHaveBeenCalled();
    expect(result.outFile).toBe(outputFile);
    expect(result.hasChanges).toBe(true);
    expect(result.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schema: 'public',
          table: 'users',
          changeKind: 'add_column',
          details: expect.objectContaining({
            column: 'last_login_at',
            type: 'timestamptz',
            nullable: true
          })
        })
      ])
    );
    expect(result.riskNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'info',
          message: expect.stringContaining('run npx ztd ztd-config')
        })
      ])
    );
  } finally {
    vi.useRealTimers();
    spy.mockRestore();
  }

  const sqlContents = readNormalizedFile(outputFile);
  const textContents = readNormalizedFile(outputFile.replace(/\.sql$/, '.txt'));
  const jsonContents = JSON.parse(readNormalizedFile(outputFile.replace(/\.sql$/, '.json')));

  expect(sqlContents).toContain('DROP TABLE IF EXISTS "public"."users" CASCADE;');
  expect(sqlContents).toContain('CREATE TABLE public.users');
  expect(sqlContents).not.toContain('-- ztd ddl diff plan');
  expect(sqlContents).not.toContain('--- local');

  expect(textContents).toContain('Migration summary');
  expect(textContents).toContain('public.users: add column last_login_at timestamptz null');
  expect(textContents).toContain(outputFile);

  expect(jsonContents).toMatchObject({
    kind: 'ddl-diff',
    hasChanges: true,
    artifacts: {
      sql: outputFile
    },
    summary: expect.arrayContaining([
      expect.objectContaining({
        schema: 'public',
        table: 'users',
        changeKind: 'add_column'
      })
    ])
  });
});

test('diff schema dry-run returns review data without writing artifacts', () => {
  const ddlDir = path.join(createTempDir('cli-diff-dry-run'), 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY
      );
    `,
    'utf8'
  );

  const outputFile = path.join(createTempDir('cli-diff-dry-run-output'), 'users.diff.sql');
  const spy = vi.spyOn(pgDumpUtil, 'runPgDump').mockReturnValue(`
    CREATE TABLE public.users (
      id serial PRIMARY KEY
    );
  `);

  try {
    const result = runDiffSchema({
      directories: [ddlDir],
      extensions: ['.sql'],
      url: 'postgres://test:secret@cli-host:5432/diff-db',
      out: outputFile,
      dryRun: true
    });

    expect(result.dryRun).toBe(true);
    expect(result.hasChanges).toBe(false);
    expect(result.text).toContain('no schema differences detected');
    expect(existsSync(outputFile)).toBe(false);
    expect(existsSync(outputFile.replace(/\.sql$/, '.txt'))).toBe(false);
    expect(existsSync(outputFile.replace(/\.sql$/, '.json'))).toBe(false);
  } finally {
    spy.mockRestore();
  }
});
