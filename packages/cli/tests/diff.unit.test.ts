import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, vi } from 'vitest';
import * as pgDumpUtil from '../src/utils/pgDump';
import { runDiffSchema } from '../src/commands/diff';

const repoRoot = path.resolve(__dirname, '../../..');
const tempRoot = path.join(repoRoot, 'tmp');

function readNormalizedFile(filePath: string): string {
  // Normalize Windows line endings so snapshots remain consistent across environments.
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function createTempDir(prefix: string): string {
  if (!existsSync(tempRoot)) {
    // Prepare the shared tmp root so mkdtempSync can create nested directories.
    mkdirSync(tempRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tempRoot, `${prefix}-`));
}

test('diff schema renderer produces unified patch with deterministic header', () => {
  const ddlDir = path.join(createTempDir('cli-diff'), 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    `
      CREATE TABLE public.users (
        id serial PRIMARY KEY,
        email text NOT NULL
      );
    `,
    'utf8'
  );

  const outputFile = path.join(createTempDir('cli-diff-output'), 'plan.diff');
  const remoteSql = `
    CREATE TABLE public.accounts (
      id bigint PRIMARY KEY,
      balance numeric
    );
  `;

  // Replace pg_dump with a stable payload so the generated patch is deterministic.
  const spy = vi.spyOn(pgDumpUtil, 'runPgDump').mockReturnValue(remoteSql);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));
  try {
    runDiffSchema({
      directories: [ddlDir],
      extensions: ['.sql'],
      url: 'postgres://test',
      out: outputFile
    });
    expect(spy).toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
    spy.mockRestore();
  }

  const contents = readNormalizedFile(outputFile);
  // Mask mkdtemp-generated cli-diff directories (cli-diff-XXXX) so the snapshot reflects the stable structure.
  const normalized = contents.replace(
    /-- Local DDL: .*tmp[\\/]+cli-diff-[^\\/]+[\\/]+ddl/,
    '-- Local DDL: <tmp/cli-diff/ddl>'
  );
  expect(normalized).toMatchSnapshot();
});
