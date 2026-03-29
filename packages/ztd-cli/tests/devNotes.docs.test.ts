import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readNormalizedFile(relativePath: string): string {
  const filePath = path.join(repoRoot, relativePath);
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

test('DEV_NOTES.md documents the SQL shadowing troubleshooting order', () => {
  const devNotes = readNormalizedFile('DEV_NOTES.md');

  expect(devNotes).toContain('For SQL-backed test failures, first confirm whether the SQL is shadowing the intended path or accidentally touching a physical table directly.');
  expect(devNotes).toContain('If shadowing is wrong, check in this order: DDL and fixture sync, fixture selection or specification, repository bug or rewriter bug.');
  expect(devNotes).toContain('Do not use DDL execution as a repair path for ZTD validation failures.');
  expect(devNotes).toContain('If the database is reachable, treat relation or missing-table errors as a shadowing, fixture, or repository problem before considering schema changes.');
});
