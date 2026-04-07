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

test('package README links every Further Reading guide from the public index', () => {
  const readme = readNormalizedFile('packages/ztd-cli/README.md');

  expectInOrder(readme, [
    '## Further Reading',
    '[SQL-first End-to-End Tutorial](../../docs/guide/sql-first-end-to-end-tutorial.md)',
    '[SQL Tool Happy Paths](../../docs/guide/sql-tool-happy-paths.md)',
    '[Perf Tuning Decision Guide](../../docs/guide/perf-tuning-decision-guide.md)',
    '[JOIN Direction Lint Specification](../../docs/guide/join-direction-lint-spec.md)',
    '[ztd-cli Telemetry Philosophy](../../docs/guide/ztd-cli-telemetry-philosophy.md)',
    '[Local-Source Development](../../docs/guide/ztd-local-source-dogfooding.md)',
    '[Codex Bootstrap Verification](../../docs/dogfooding/ztd-codex-bootstrap-verification.md)',
    '[ztd-cli spawn EPERM Investigation](../../docs/dogfooding/ztd-cli-spawn-eperm-investigation.md)',
    '[ztd Onboarding Verification](../../docs/dogfooding/ztd-onboarding-dogfooding.md)'
  ]);
});

test('Further Reading docs stay aligned with the current standalone and CLI behavior', () => {
  const expectations: Array<{ docPath: string; phrases: string[] }> = [
    {
      docPath: 'docs/guide/sql-first-end-to-end-tutorial.md',
      phrases: [
        'This tutorial shows the shortest path from `ztd init --starter` to a small `users` feature',
        'npx ztd agents init',
        'The smallest DB-backed starter example lives in `src/features/smoke/tests/smoke.queryspec.test.ts`.',
        '`@rawsql-ts/testkit-postgres` and `createPostgresTestkitClient`',
        'optional customer-facing Codex bootstrap (installed by `npx ztd agents init`)',
        'Docker Desktop or another Docker daemon is already running',
        'cp .env.example .env',
        '# edit ZTD_DB_PORT=5433',
        'docker compose up -d',
        'The starter setup derives `ZTD_DB_URL` from `.env`',
        'If port `5432` is already in use, update `ZTD_DB_PORT` in `.env` before you rerun the compose path, for example:',
        'Copy-Item .env.example .env',
        'npx ztd query uses column users.email --specs-dir src/features/users-insert --any-schema --view detail',
        'Passing the feature folder as `--specs-dir` is a normal way to narrow the project-wide scan, not a workaround for feature-local layouts.',
        'npx ztd model-gen --probe-mode ztd src/features/users-insert/insert-users/insert-users.sql --out src/features/users-insert/insert-users/queryspec.ts',
        'model-gen` now treats the SQL file location as the primary contract source',
        'Read the review summary first:',
        '- the risks section lists destructive and operational apply-plan risks separately',
        'npx ztd ddl risk --file tmp/users.diff.sql',
        'current `ztd ddl diff` CLI does not expose the lower-level drop-avoidance options from core',
        'npx vitest run',
        'generated `tableDefinitions` are the normal runtime path after `ztd-config`',
        'explicit `tableDefinitions` / `tableRows` are for local tests that want direct fixtures',
        '`ddl.directories` is the fallback only when no generated manifest exists'
      ]
    },
    {
      docPath: 'packages/testkit-postgres/README.md',
      phrases: [
        'createPostgresTestkitClient',
        'defaultSchema',
        'searchPath',
        'public.users',
        'Generated fixture manifests',
        'ddl.directories'
      ]
    },
    {
      docPath: 'docs/dogfooding/ztd-migration-lifecycle.md',
      phrases: [
        'The goal is to confirm that a prompt can point an AI agent at the right files',
        'migration artifact creation',
        'tmp/users.diff.sql',
        'npx ztd ddl risk --file tmp/users.diff.sql',
        'npx ztd model-gen --probe-mode ztd src/features/users/persistence/users.sql --out src/features/users/persistence/users.spec.ts',
        '`ZTD_DB_URL` is the only implicit database owned by ztd-cli.',
        'Use `--url` or a full `--db-*` flag set for any other inspection target.',
        'The feature folder is one narrowed spec set inside the normal project-wide discovery flow.',
        'inspect the structured risks second',
        'Do not apply migrations automatically.'
      ]
    },
    {
      docPath: 'docs/guide/query-uses-impact-checks.md',
      phrases: [
        'The active scan set is **project-wide by default**.',
        'Use `--specs-dir` only when you want to narrow the scan to one slice or sub-tree.',
        'prefers feature-local spec-relative paths, then tries project-relative paths',
        'npx ztd query uses column users.email --specs-dir src/features/users/persistence --any-schema --view detail'
      ]
    },
    {
      docPath: 'docs/guide/perf-tuning-decision-guide.md',
      phrases: [
        'tuning stays evidence-driven and does not require breaking the SQL shape first',
        'ztd query plan <sql-file>',
        'ztd perf db reset --dry-run',
        'ztd perf run --dry-run',
        'direct vs decomposed'
      ]
    },
    {
      docPath: 'docs/guide/sql-tool-happy-paths.md',
      phrases: [
        'Use it when the problem is not "how do I use every command?" but "which command should I run first?"',
        '`ztd query plan <sql-file>`',
        '`ztd perf run --dry-run ...`',
        '`ztd query uses <target>`',
        'Telemetry is an opt-in branch after the structural path is known.'
      ]
    },
    {
      docPath: 'docs/guide/ztd-cli-agent-interface.md',
      phrases: [
        'Use `ztd --output json ...` to request a JSON envelope on stdout.',
        'Prefer `--dry-run` before commands that write files.',
        'Use `--json <payload>` on supported commands when nested option construction is easier than individual flags.',
        'Use `ztd init --with-ai-guidance` to write managed internal guidance under `.ztd/agents/`',
        'Use `ztd agents status` to inspect customer-facing bootstrap targets separately from internal `.ztd` guidance, and to distinguish managed templates from user-owned instruction files.',
        'Use `ztd agents init --dry-run` when you want the planned customer-facing bootstrap set before writing files.',
        'treat `summary` as the logical diff, treat `risks` as the apply-plan risk list',
        'Use `ztd ddl risk --file <migration.sql>` when you need to evaluate a generated or hand-edited migration SQL file directly',
        '`ztd model-gen` now treats feature-local SQL files as the primary contract source',
        'ZTD_DB_URL',
        'Do not assume `DATABASE_URL` is a usable default target',
        'Visible `AGENTS.md` files are opt-in via `ztd agents init`',
        '.codex/config.toml',
        '`managed`',
        '`unmanaged-conflict`'
      ]
    },
    {
      docPath: 'docs/guide/feature-index.md',
      phrases: [
        'Codex bootstrap init',
        'ztd agents init'
      ]
    },
    {
      docPath: 'docs/dogfooding/ztd-application-lifecycle.md',
      phrases: [
        'confirm that an AI agent can read the Codex bootstrap files after you opt in with `ztd agents init`',
        '`ztd agents init`',
        '.codex/agents/*'
      ]
    },
    {
      docPath: 'packages/ztd-cli/README.md',
      phrases: [
        'npx ztd agents init',
        'If an AI-authored ZTD test fails, do not assume the prompt or case file is the only problem; check whether `ztd-cli` or `rawsql-ts` changed the manifest or rewrite path.',
        'If you see `user_id: null`, compare the direct database `INSERT ... RETURNING ...` result with the ZTD result and inspect `.ztd/generated/ztd-fixture-manifest.generated.ts` first.',
        'If a local-source workspace is meant to reflect a source change, verify that it resolves `rawsql-ts` from the local source tree rather than a registry copy.',
        'After you finish the SQL and DTO edits, run `npx ztd feature tests scaffold --feature <feature-name>` to refresh `src/features/<feature-name>/<query-name>/tests/generated/TEST_PLAN.md` and `analysis.json`.',
        'generated/*` is CLI-owned and refreshable, `cases/*` is human/AI-owned and kept, and the thin entrypoint is kept.',
        'Do not apply migrations automatically.'
      ]
    },
    {
      docPath: 'docs/dogfooding/ztd-codex-bootstrap-verification.md',
      phrases: [
        'reviewer-checkable verification pass',
        'Fresh Project Verification',
        'What Was Installed',
        'How To Verify',
        'What Becomes Possible',
        'Guarantee Limits',
        'Weak Spots Or Out Of Scope Areas'
      ]
    },
    {
      docPath: 'docs/dogfooding/ztd-cli-spawn-eperm-investigation.md',
      phrases: [
        '## Source issue',
        '## Why blocker',
        '## Reproduction',
        '## Investigation steps',
        '## Findings',
        '## Conclusion',
        '## Impact on acceptance items',
        '## What should happen next',
        '## Recurrence prevention',
        '## Reviewer conclusion',
        'pnpm --filter @rawsql-ts/ztd-cli test',
        'pnpm --filter @rawsql-ts/ztd-cli exec vitest',
        'pnpm --filter @rawsql-ts/ztd-cli test -- --run tests/utils/agents.test.ts',
        'build` -> passed',
        'lint` -> passed',
        'child_process.spawn(',
        'B. This PR\'s code changes are not the primary cause.',
        'Local Windows environment reproduces `spawn EPERM` below the Issue #685 change layer.',
        'Current evidence is insufficient to mark acceptance items 1-3 as done.',
        'Next decision depends on CI or alternate-environment verification.'
      ]
    },
    {
      docPath: 'docs/dogfooding/ztd-onboarding-dogfooding.md',
      phrases: [
        '## What was run',
        '## Exact order',
        '## README Quickstart step-by-step outcome',
        '## Where the new bootstrap helped',
        '## Where the new bootstrap was redundant or confusing',
        '## What remains unverified',
        'npm install -D @rawsql-ts/ztd-cli vitest typescript',
        'npx ztd init --starter',
        'npx ztd agents init',
        '.env.example',
        'docker compose up -d',
        'npx ztd ztd-config',
        'npx vitest run',
        'README Quickstart path in a fresh directory outside the monorepo workspace root.',
        'The onboarding order introduced by Issue #685 is coherent'
      ]
    },
    {
      docPath: 'docs/dogfooding/perf-scale-tuning.md',
      phrases: [
        'The goal is to keep the decision between **index tuning** and **pipeline tuning** explicit, reproducible, and backed by QuerySpec metadata plus local DDL.',
        'QuerySpec `metadata.perf`',
        '`perf/seed.yml`',
        '`ztd perf db reset --dry-run`',
        '`ztd perf run`',
        'compare `--strategy direct` and `--strategy decomposed`'
      ]
    },
    {
      docPath: 'docs/guide/published-package-verification.md',
      phrases: [
        'not a perfect substitute for a real registry publish',
        'Run this from the repository root:',
        '`pnpm verify:published-package-mode`',
        'Packed tarballs do not leak `workspace:*`',
        'The standalone smoke app passes, but local-source dogfooding fails.',
        'A real post-publish smoke check is still required.'
      ]
    },
    {
      docPath: 'docs/guide/ztd-local-source-dogfooding.md',
      phrases: [
        'throwaway project under `tmp/`',
        '`ztd init --local-source-root <monorepo-root>`',
        'ztd model-gen src/features/users/persistence/list_users.sql \\',
        '`pnpm install --ignore-workspace`',
        'Do not use it to claim that the published npm consumer flow is already healthy',
        'Use this mode to answer: `can we dogfood the unreleased CLI from source?`'
      ]
    },
    {
      docPath: 'docs/guide/ztd-cli-telemetry-philosophy.md',
      phrases: [
        'intentionally **not** part of the default happy path',
        'Published-package consumers must be able to ignore telemetry completely.',
        'Enable telemetry when you are:',
        'Leave it off for normal published-package usage, happy-path setup, and standard project scaffolding.'
      ]
    },
    {
      docPath: 'docs/guide/join-direction-lint-spec.md',
      phrases: [
        '`ztd query lint --rules join-direction`',
        '`npx ztd query lint --help`',
        '`--rules <list>`',
        '`unknown option \'--rules\'`',
        '`parent -> child` is not a universal anti-pattern.',
        'v1 uses **FK-only** relation evidence.',
        '`LEFT JOIN` can be a clean parent-first pattern when the query intentionally preserves the parent row set.',
        'skip'
      ]
    }
  ];

  for (const { docPath, phrases } of expectations) {
    const doc = readNormalizedFile(docPath);
    for (const phrase of phrases) {
      expect(doc, `${docPath} should contain ${phrase}`).toContain(phrase);
    }
  }
});

test('spawn EPERM investigation doc stays sanitized for reviewer-facing publication', () => {
  const doc = readNormalizedFile('docs/dogfooding/ztd-cli-spawn-eperm-investigation.md');

  expect(doc).toContain('<repo-root>');
  expect(doc).toContain('<workspace>');
  expect(doc).not.toMatch(/C:\\Users\\/);
  expect(doc).not.toMatch(/OneDrive\\/);
});

test('quickstart and tutorial spell out the common 5432 collision fallback', () => {
  const packageReadme = readNormalizedFile('packages/ztd-cli/README.md');
  const scaffoldReadme = readNormalizedFile('packages/ztd-cli/templates/README.md');
  const tutorial = readNormalizedFile('docs/guide/sql-first-end-to-end-tutorial.md');

  expect(packageReadme).toContain('.env.example');
  expect(packageReadme).toContain('ZTD_DB_PORT');
  expect(packageReadme).toContain('If port `5432` is already in use, change `ZTD_DB_PORT` in `.env` and then verify recovery with:');
  expect(packageReadme).toContain('cp .env.example .env');
  expect(packageReadme).toContain('docker compose up -d');
  expect(packageReadme).toContain('npx vitest run');
  expect(scaffoldReadme).toContain('When you add SQL-backed tests, copy `.env.example` to `.env` and adjust `ZTD_DB_PORT` if needed before running the DB-backed suites.');
  expect(scaffoldReadme).toContain('Starter-owned shared support lives at `tests/support/ztd/`, while `.ztd/` is the tool-managed workspace for generated metadata and support files.');
  expect(tutorial).toContain('If port `5432` is already in use, update `ZTD_DB_PORT` in `.env` before you rerun the compose path, for example:');
  expect(tutorial).toContain('cp .env.example .env');
  expect(tutorial).toContain('Copy-Item .env.example .env');
});
