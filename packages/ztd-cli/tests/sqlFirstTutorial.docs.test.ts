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
    'DDL repair | `npx ztd query uses column users.email --scope-dir src/features/users-insert --any-schema --view detail`',
    'SQL repair | `npx ztd model-gen --probe-mode ztd src/features/users-insert/queries/insert-users/insert-users.sql`',
    'DTO repair | `npx vitest run` after the DTO change',
    'migration | `npx ztd ztd-config`, optionally `npx ztd ddl pull --url <target-db-url>` to inspect the target, then `npx ztd ddl diff --url <target-db-url> --out tmp/users.diff.sql` to prepare review output plus apply SQL',
    'tuning | `npx ztd query plan <sql-file>` and the perf guide under `docs/guide/`',
    'npx ztd init --starter',
    'src/features/smoke',
    'db/ddl/public.sql',
        'The smallest DB-backed starter example lives in `src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts`.',
    'It uses `@rawsql-ts/testkit-postgres` and `createPostgresTestkitClient`',
    'Docker Desktop or another Docker daemon is already running',
    'cp .env.example .env',
    '# edit ZTD_DB_PORT=5433 if needed',
    'docker compose up -d',
    'npx vitest run',
    'The starter setup derives `ZTD_DB_URL` from `.env`',
    'If port `5432` is already in use, update `ZTD_DB_PORT` in `.env` before you rerun the compose path, for example:',
    'Copy-Item .env.example .env',
    '# edit ZTD_DB_PORT=5433',
    'docker compose up -d',
    'npx vitest run',
    'Use `src/features/smoke` as the starter-only teaching example, but scaffold the first real CRUD slice with the CLI:',
    'npx ztd feature scaffold --table users --action insert',
    'src/features/users-insert/boundary.ts',
    'src/features/users-insert/tests/users-insert.boundary.test.ts',
    'src/features/users-insert/queries/insert-users/boundary.ts',
    'src/features/users-insert/queries/insert-users/insert-users.sql',
    'src/features/users-insert/queries/insert-users/tests/',
  ]);

  expect(tutorial).toContain('queries/insert-users/tests/insert-users.boundary.ztd.test.ts');
  expect(tutorial).toContain('queries/insert-users/tests/generated/');
  expect(tutorial).toContain('queries/insert-users/tests/cases/');
  expect(tutorial).toContain('persistent case files');
  expect(tutorial).toContain('Add a users insert feature to this feature-first project.');
  expect(tutorial).not.toContain('AGENTS.md');
  expect(tutorial).not.toContain('.codex/agents');
  expect(tutorial).not.toContain('.ztd/agents');
  expect(tutorial).toContain('Start with `npx ztd feature scaffold --table users --action insert`.');
  expect(tutorial).toContain('Keep `boundary.ts`, the query-local `boundary.ts`, and the query-local SQL resource inside `src/features/users-insert`.');
  expect(tutorial).toContain('Keep shared feature seams under `src/features/_shared/*`, shared verification seams under `tests/support/*`, driver-neutral contracts under `src/libraries/*`, and driver or sink bindings under `src/adapters/<tech>/*`.');
  expect(tutorial).toContain('The feature scaffold creates the boundary files, SQL file, feature-root boundary test, and the query-local `tests/generated/` plus `tests/cases/` directories.');
  expect(tutorial).toContain('That command refreshes `src/features/users-insert/queries/insert-users/tests/generated/TEST_PLAN.md` and `analysis.json`, refreshes `src/features/users-insert/queries/insert-users/tests/boundary-ztd-types.ts`, and creates the thin `src/features/users-insert/queries/insert-users/tests/insert-users.boundary.ztd.test.ts` Vitest entrypoint only if it is missing.');
  expect(tutorial).toContain('Persistent case files under `src/features/users-insert/queries/insert-users/tests/cases/` stay human/AI-owned and are not overwritten.');
  expect(tutorial).toContain('The validation cases may stay at the feature boundary, but the success case must execute through the fixed app-level ZTD runner and verify the returned result.');
  expect(tutorial).toContain('Do not put returned columns into the input fixture.');
  expect(tutorial).toContain('If the returned id is null, stop and fix the scaffold or DDL instead of weakening the test.');
  expect(tutorial).toContain('Before writing the success-path assertion, inspect `insert-users.sql` and `boundary.ts`. If the scaffold does not actually return a non-null id, report that mismatch instead of inventing fixture data or schema overrides.');
  expect(tutorial).toContain('When the cases are ready, run `npx vitest run src/features/users-insert/queries/insert-users/tests/insert-users.boundary.ztd.test.ts` to execute the ZTD query test.');
  expect(tutorial).toContain('npx ztd query uses column users.email --scope-dir src/features/users-insert --any-schema --view detail');
  expect(tutorial).toContain('Passing the feature folder as `--scope-dir` is a normal way to narrow the project-wide scan, not a workaround for feature-local layouts.');
  expect(tutorial).toContain('For SQL repair, keep the SQL assets under `src/features/users-insert/queries/insert-users/`, keep the query on the starter DDL\'s `users` table, and rerun `model-gen` against `src/features/users-insert/queries/insert-users/insert-users.sql` directly to inspect the generated contract on stdout before you update the handwritten query boundary.');
  expect(tutorial).toContain('If you want to save that output for reference or gradual migration, write it to a dedicated generated-contract file with `--out` instead of overwriting handwritten runtime files.');
  expect(tutorial).toContain('Do not target `src/features/users-insert/queries/insert-users/boundary.ts` with `--out`, because that file is the runtime boundary that also owns `loadSqlResource` and the execution flow.');
  expect(tutorial).toContain('In VSA layouts, `model-gen` now treats the SQL file location as the primary contract source, so `--sql-root` is only needed for older shared-root layouts.');
  expect(tutorial).toContain('npx ztd ztd-config');
  expect(tutorial).toContain('npx ztd ddl diff');

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
