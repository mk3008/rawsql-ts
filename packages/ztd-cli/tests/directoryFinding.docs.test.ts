import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readNormalizedFile(relativePath: string): string {
  const filePath = path.join(repoRoot, relativePath);
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

test('readmes promote the feature-first layout without tables/views taxonomy', () => {
  const rootReadme = readNormalizedFile('README.md');
  const packageReadme = readNormalizedFile('packages/ztd-cli/README.md');
  const scaffoldReadme = readNormalizedFile('packages/ztd-cli/templates/README.md');
  const featuresReadme = readNormalizedFile('packages/ztd-cli/templates/src/features/README.md');
  const smokeReadme = readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/README.md');

  for (const doc of [rootReadme, packageReadme, scaffoldReadme, featuresReadme, smokeReadme]) {
    expect(doc).toContain('src/features');
    expect(doc).not.toContain('tables/views');
  }

  expect(rootReadme).toContain('feature-first');
  expect(packageReadme).toContain('feature-first');
  expect(scaffoldReadme).toContain('feature-first');
  expect(featuresReadme).toContain('smoke');
  expect(smokeReadme).toContain('starter-only sample feature');
  expect(smokeReadme).toContain('three narrow paths');
  expect(smokeReadme).toContain('DB-backed smoke test');
  expect(smokeReadme).toContain('createStarterPostgresTestkitClient');
  expect(rootReadme).toContain('Migration Repair Loop');
  expect(packageReadme).toContain('Quickstart');
  expect(packageReadme).toContain('Create the Users Insert Feature');
  expect(packageReadme).toContain('Highlights');
  expect(packageReadme).toContain('Command Index');
  expect(packageReadme).toContain('Glossary');
  expect(packageReadme).toContain('Further Reading');
  expect(packageReadme).toContain('ZTD here means query-boundary-local cases that execute through the fixed app-level harness against the real database engine, not a mocked executor.');
  expect(packageReadme).toContain('Use validation-only cases for boundary checks and DB-backed cases for the success path.');
  expect(packageReadme).toContain('Keep the feature-root `src/features/<feature-name>/tests/<feature-name>.boundary.test.ts` for mock-based boundary tests.');
  expect(packageReadme).toContain('Starter-owned shared support lives under `tests/support/ztd/`; `.ztd/` remains the tool-managed workspace for generated metadata and support files.');
  expect(packageReadme).toContain('src/adapters/<tech>');
  expect(packageReadme).toContain('src/adapters/pg/');
  expect(packageReadme).toContain('src/adapters/aws/s3/');
  expect(packageReadme).toContain('src/libraries/*');
  expect(packageReadme).toContain('After you finish the SQL and DTO edits');
  expect(packageReadme).toContain('feature tests scaffold --feature <feature-name>');
  expect(packageReadme).toContain('tests/generated/TEST_PLAN.md');
  expect(scaffoldReadme).toContain('src/features`, `src/adapters`, and `src/libraries` as the app-code roots');
  expect(scaffoldReadme).toContain('Make sure the query-boundary result executes through the DB-backed ZTD path and checks mapping and validation, not just property values.');
  expect(readNormalizedFile('docs/guide/sql-first-end-to-end-tutorial.md')).toContain('Scenario CLI at a glance');
  expect(readNormalizedFile('docs/dogfooding/ztd-migration-lifecycle.md')).toContain('Preferred CLI by scenario');
  expect(packageReadme).toContain('## Further Reading');
  expect(readNormalizedFile('docs/guide/perf-tuning-decision-guide.md')).toContain(
    'tuning stays evidence-driven and does not require breaking the SQL shape first'
  );
  expect(readNormalizedFile('docs/dogfooding/perf-scale-tuning.md')).toContain(
    'without breaking the SQL unless the evidence shows that SQL shape itself must change'
  );
});

test('feature README and scaffold files center the sample feature and recursive boundary folders', () => {
  const files = [
    'packages/ztd-cli/templates/src/features/README.md',
    'packages/ztd-cli/templates/src/features/smoke/README.md',
    'packages/ztd-cli/templates/src/features/smoke/boundary.ts',
    'packages/ztd-cli/templates/src/features/smoke/tests/smoke.boundary.test.ts'
  ];

  for (const file of files) {
    const contents = readNormalizedFile(file);
    expect(contents).toContain('feature');
    expect(contents.toLowerCase()).toContain('smoke');
    expect(contents).not.toContain('tables/views');
  }

  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/README.md').toLowerCase()).toContain('feature-first');
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/README.md')).toContain('boundary.ts');
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/boundary.ts')).toContain(
    'executeSmokeEntrySpec'
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/queries/smoke/boundary.ts')).toContain(
    'executeSmokeQuerySpec'
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/queries/smoke/smoke.sql')).toContain(
    'where user_id = :user_id::integer'
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/tests/smoke.boundary.test.ts')).toContain(
    'executeSmokeEntrySpec'
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts')).toContain(
    'runQuerySpecZtdCases'
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/_shared/featureQueryExecutor.ts')).toContain(
    'FeatureQueryExecutor'
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/_shared/loadSqlResource.ts')).toContain(
    'loadSqlResource'
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/libraries/sql/sql-client.ts')).toContain('SqlClient');
  expect(readNormalizedFile('packages/ztd-cli/templates/src/adapters/pg/sql-client.ts')).toContain('fromPg');
  expect(readNormalizedFile('packages/ztd-cli/templates/src/adapters/pg/sql-client.ts')).toContain(
    "from '#libraries/sql/sql-client.js'"
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/adapters/console/repositoryTelemetry.ts')).toContain(
    "from '#libraries/telemetry/types.js'"
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/tests/support/testkit-client.webapi.ts')).toContain(
    "from '#libraries/sql/sql-client.js'"
  );
});

test('feature-first scaffold files exist in the template bundle', () => {
  const requiredPaths = [
    'packages/ztd-cli/templates/src/features/README.md',
    'packages/ztd-cli/templates/src/features/smoke/README.md',
    'packages/ztd-cli/templates/src/features/smoke/boundary.ts',
    'packages/ztd-cli/templates/src/features/smoke/tests/smoke.boundary.test.ts',
    'packages/ztd-cli/templates/src/features/smoke/queries/smoke/boundary.ts',
    'packages/ztd-cli/templates/src/features/smoke/queries/smoke/smoke.sql',
    'packages/ztd-cli/templates/src/features/smoke/queries/smoke/tests/smoke.boundary.ztd.test.ts',
    'packages/ztd-cli/templates/src/features/smoke/queries/smoke/tests/boundary-ztd-types.ts',
    'packages/ztd-cli/templates/src/features/smoke/queries/smoke/tests/cases/basic.case.ts',
    'packages/ztd-cli/templates/src/features/smoke/queries/smoke/tests/generated/TEST_PLAN.md',
    'packages/ztd-cli/templates/src/features/smoke/queries/smoke/tests/generated/analysis.json',
    'packages/ztd-cli/templates/src/features/_shared/featureQueryExecutor.ts',
    'packages/ztd-cli/templates/src/features/_shared/loadSqlResource.ts',
    'packages/ztd-cli/templates/src/libraries/README.md',
    'packages/ztd-cli/templates/src/libraries/sql/README.md',
    'packages/ztd-cli/templates/src/libraries/sql/sql-client.ts',
    'packages/ztd-cli/templates/src/libraries/telemetry/repositoryTelemetry.ts',
    'packages/ztd-cli/templates/src/adapters/README.md',
    'packages/ztd-cli/templates/src/adapters/pg/sql-client.ts',
    'packages/ztd-cli/templates/src/adapters/console/repositoryTelemetry.ts'
  ];

  for (const requiredPath of requiredPaths) {
    expect(existsSync(path.join(repoRoot, requiredPath))).toBe(true);
  }

  const removedPaths = [
    'packages/ztd-cli/templates/AGENTS.md',
    'packages/ztd-cli/templates/CONTEXT.md',
    'packages/ztd-cli/templates/PROMPT_DOGFOOD.md',
    'packages/ztd-cli/templates/.codex/config.toml',
    'packages/ztd-cli/templates/.codex/agents/planning.md',
    'packages/ztd-cli/templates/.codex/agents/troubleshooting.md',
    'packages/ztd-cli/templates/.codex/agents/next-steps.md',
    'packages/ztd-cli/templates/.agents/skills/quickstart/SKILL.md',
    'packages/ztd-cli/templates/.agents/skills/troubleshooting/SKILL.md',
    'packages/ztd-cli/templates/.agents/skills/next-steps/SKILL.md'
  ];

  for (const removedPath of removedPaths) {
    expect(existsSync(path.join(repoRoot, removedPath))).toBe(false);
  }
});
