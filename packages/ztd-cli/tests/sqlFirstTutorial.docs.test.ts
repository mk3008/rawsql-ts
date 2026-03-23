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
    'This tutorial shows the shortest path from `ztd init --starter` to a small `users` feature that can be changed, broken, and repaired with AI help.',
    'The tutorial uses one starter project, one `smoke` feature, and one `users` feature.',
    'DDL repair | `npx ztd query uses column users.email --specs-dir src/features/users/persistence --any-schema --view detail`',
    'SQL repair | `npx ztd model-gen --probe-mode ztd src/features/users/persistence/users.sql --out src/features/users/persistence/users.spec.ts`',
    'DTO repair | `npx vitest run` after the DTO change',
    'migration | `npx ztd ztd-config`, optionally `npx ztd ddl pull --url <target-db-url>` to inspect the target, then `npx ztd ddl diff --url <target-db-url> --out tmp/users.diff.sql` to prepare review output plus apply SQL',
    'tuning | `npx ztd query plan <sql-file>` and the perf guide under `docs/guide/`',
    'npx ztd init --starter',
    'src/features/smoke',
    'ztd/ddl/demo.sql',
    'docker compose up -d',
    'npx vitest run',
    'docker run -d --rm --name ztd-starter-pg',
    'localhost:5433/ztd',
    'pnpm add -D @rawsql-ts/adapter-node-pg',
    'Use `src/features/smoke` as the teaching example and add `src/features/users` as the first real feature.',
    'src/features/users/domain',
    'src/features/users/application',
    'src/features/users/persistence',
    'src/features/users/tests',
    'npx ztd query uses column users.email --specs-dir src/features/users/persistence --any-schema --view detail',
    'Passing the feature folder as `--specs-dir` is a normal way to narrow the project-wide scan, not a workaround for feature-local layouts.',
    'For SQL repair, keep the SQL assets under the feature folder, keep the query on the starter DDL\'s `users` table, and rerun `model-gen` against the feature-local SQL file directly.',
    'In VSA layouts, `model-gen` now treats the SQL file location as the primary contract source, so `--sql-root` is only needed for older shared-root layouts.',
    'npx ztd ztd-config',
    'npx ztd ddl diff'
  ]);

  expect(tutorial).toContain('npx ztd ddl risk --file tmp/users.diff.sql');
});

test('guide navigation and feature index surface the tutorial', () => {
  const sidebar = readNormalizedFile('docs/.vitepress/config.mts');
  const featureIndex = readNormalizedFile('docs/guide/feature-index.md');

  expect(sidebar).toContain('/guide/sql-first-end-to-end-tutorial');
  expect(featureIndex).toContain('SQL-first End-to-End Tutorial');
  expect(featureIndex).toContain('./sql-first-end-to-end-tutorial.md');
});
