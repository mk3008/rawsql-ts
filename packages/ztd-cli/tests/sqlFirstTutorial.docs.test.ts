import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readNormalizedFile(relativePath: string): string {
  const filePath = path.join(repoRoot, relativePath);
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function expectInOrder(haystack: string, needles: string[]): void {
  let cursor = 0;
  for (const needle of needles) {
    const index = haystack.indexOf(needle, cursor);
    expect(index, `Expected to find "${needle}" after offset ${cursor}`).toBeGreaterThanOrEqual(0);
    cursor = index + needle.length;
  }
}

test('root README links to the SQL-first end-to-end tutorial', () => {
  const readme = readNormalizedFile('README.md');

  expect(readme).toContain('SQL-first End-to-End Tutorial');
  expect(readme).toContain('./docs/guide/sql-first-end-to-end-tutorial.md');
});

test('the tutorial preserves the shortest DDL to first test path', () => {
  const tutorial = readNormalizedFile('docs/guide/sql-first-end-to-end-tutorial.md');

  expectInOrder(tutorial, [
    'This tutorial shows the shortest path from DDL to the first passing test.',
    'It walks the sequence `DDL -> SQL -> ztd-config -> model-gen -> repository wiring -> first test`',
    'npm init -y',
    'npm install -D @rawsql-ts/ztd-cli vitest typescript',
    'npx ztd init --yes --workflow empty --validator zod',
    'create table public.users',
    'src/sql/users/list_active_users.sql',
    'npx ztd ztd-config',
    'npx ztd model-gen src/sql/users/list_active_users.sql --probe-mode ztd --out src/catalog/specs/users/list_active_users.spec.ts',
    'src/repositories/users/list-active-users.ts',
    'tests/smoke.test.ts',
    'npm run test'
  ]);
});

test('guide navigation and feature index surface the tutorial', () => {
  const sidebar = readNormalizedFile('docs/.vitepress/config.mts');
  const featureIndex = readNormalizedFile('docs/guide/feature-index.md');

  expect(sidebar).toContain('/guide/sql-first-end-to-end-tutorial');
  expect(featureIndex).toContain('SQL-first End-to-End Tutorial');
  expect(featureIndex).toContain('./sql-first-end-to-end-tutorial.md');
});
