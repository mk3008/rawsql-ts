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
    'DDL repair | `npx ztd query uses column users.email --specs-dir src/features/users-insert --any-schema --view detail`',
    'SQL repair | `npx ztd model-gen --probe-mode ztd src/features/users-insert/insert-users/insert-users.sql --out src/features/users-insert/insert-users/queryspec.ts`',
    'DTO repair | `npx vitest run` after the DTO change',
    'migration | `npx ztd ztd-config`, optionally `npx ztd ddl pull --url <target-db-url>` to inspect the target, then `npx ztd ddl diff --url <target-db-url> --out tmp/users.diff.sql` to prepare review output plus apply SQL',
    'tuning | `npx ztd query plan <sql-file>` and the perf guide under `docs/guide/`',
    'npx ztd init --starter',
    'src/features/smoke',
    'db/ddl/public.sql',
    'The smallest DB-backed starter example lives in `src/features/smoke/tests/smoke.queryspec.test.ts`.',
    'It uses `@rawsql-ts/testkit-postgres` and `createPostgresTestkitClient`',
    'Docker Desktop or another Docker daemon is already running',
    'cp .env.example .env',
    '# edit ZTD_DB_PORT=5433 if needed',
    'docker compose up -d',
    'npx vitest run',
    'The starter setup derives `ZTD_TEST_DATABASE_URL` from `.env`',
    'If port `5432` is already in use, update `ZTD_DB_PORT` in `.env` before you rerun the compose path, for example:',
    'Copy-Item .env.example .env',
    '# edit ZTD_DB_PORT=5433',
    'docker compose up -d',
    'npx vitest run',
    'Use `src/features/smoke` as the starter-only teaching example, but scaffold the first real CRUD slice with the CLI:',
    'npx ztd feature scaffold --table users --action insert',
    'src/features/users-insert/entryspec.ts',
    'src/features/users-insert/insert-users/queryspec.ts',
    'src/features/users-insert/insert-users/insert-users.sql',
    'src/features/users-insert/tests/',
    'The CLI creates the `tests/` directory but leaves the two test files for the AI follow-up step.',
    'Add a users insert feature to this feature-first project.',
    'Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.ztd/agents/*` if present.',
    'Start with `npx ztd feature scaffold --table users --action insert`.',
    'Keep `entryspec.ts`, the query-local `queryspec.ts`, and the query-local SQL resource inside `src/features/users-insert`.',
    'Add the two tests in src/features/users-insert/tests as the follow-up step.',
    'npx ztd query uses column users.email --specs-dir src/features/users-insert --any-schema --view detail',
    'Passing the feature folder as `--specs-dir` is a normal way to narrow the project-wide scan, not a workaround for feature-local layouts.',
    'For SQL repair, keep the SQL assets under `src/features/users-insert/insert-users/`, keep the query on the starter DDL\'s `users` table, and rerun `model-gen` against `src/features/users-insert/insert-users/insert-users.sql` directly, writing back to `src/features/users-insert/insert-users/queryspec.ts`.',
    'In VSA layouts, `model-gen` now treats the SQL file location as the primary contract source, so `--sql-root` is only needed for older shared-root layouts.',
    'npx ztd ztd-config',
    'npx ztd ddl diff'
  ]);

  expect(tutorial).toContain('npx ztd ddl risk --file tmp/users.diff.sql');
  expect(tutorial).toContain('generated `tableDefinitions` are the normal runtime path after `ztd-config`');
  expect(tutorial).toContain('explicit `tableDefinitions` / `tableRows` are for local tests that want direct fixtures');
  expect(tutorial).toContain('`ddl.directories` is the fallback only when no generated manifest exists');
  expect(tutorial).toContain('the agent edits the `users-insert` feature only');
});

test('guide navigation and feature index surface the tutorial', () => {
  const sidebar = readNormalizedFile('docs/.vitepress/config.mts');
  const featureIndex = readNormalizedFile('docs/guide/feature-index.md');

  expect(sidebar).toContain('/guide/sql-first-end-to-end-tutorial');
  expect(featureIndex).toContain('SQL-first End-to-End Tutorial');
  expect(featureIndex).toContain('./sql-first-end-to-end-tutorial.md');
});
