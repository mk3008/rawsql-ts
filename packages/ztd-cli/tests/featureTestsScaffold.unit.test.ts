import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { runFeatureTestsScaffoldCommand } from '../src/commands/featureTests';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

test('runFeatureTestsScaffoldCommand writes query-local ZTD scaffolds from the current feature files', async () => {
  const workspace = createTempDir('feature-tests-scaffold');
  const featureDir = path.join(workspace, 'src', 'features', 'users-insert');
  const queryDir = path.join(featureDir, 'insert-users');
  mkdirSync(queryDir, { recursive: true });

  writeFileSync(
    path.join(featureDir, 'entryspec.ts'),
    [
      "import { z } from 'zod';",
      '',
      'const RequestSchema = z.object({',
      '  email: z.string()',
      '}).strict();',
      '',
      'export async function executeUsersInsertEntrySpec() {',
      '  return RequestSchema.parse({ email: "alice@example.com" });',
      '}'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(queryDir, 'queryspec.ts'),
    [
      "export async function executeInsertUsersQuerySpec() {",
      '  return { user_id: "placeholder" };',
      '}'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(queryDir, 'insert-users.sql'),
    'insert into public.users (email) values (:email) returning user_id;',
    'utf8'
  );

  const result = await runFeatureTestsScaffoldCommand({
    feature: 'users-insert',
    rootDir: workspace
  });

  expect(result).toMatchObject({
    featureName: 'users-insert',
    queryName: 'insert-users',
    dryRun: false
  });
  expect(result.outputs.map((output) => output.path)).toEqual(
    expect.arrayContaining([
      'src/features/users-insert/insert-users/tests',
      'src/features/users-insert/insert-users/tests/generated',
      'src/features/users-insert/insert-users/tests/cases',
      'src/features/users-insert/insert-users/tests/insert-users.queryspec.ztd.test.ts',
      'src/features/users-insert/insert-users/tests/cases/basic.case.ts',
      'src/features/users-insert/insert-users/tests/generated/TEST_PLAN.md',
      'src/features/users-insert/insert-users/tests/generated/analysis.json'
    ])
  );

  const vitestEntrypointFile = readFileSync(
    path.join(featureDir, 'insert-users', 'tests', 'insert-users.queryspec.ztd.test.ts'),
    'utf8'
  );
  expect(vitestEntrypointFile).toContain("import { expect, test } from 'vitest';");
  expect(vitestEntrypointFile).toContain("import { runQuerySpecZtdCases } from '../../../../../tests/ztd/harness.js';");
  expect(vitestEntrypointFile).toContain("import { executeInsertUsersQuerySpec } from '../queryspec.js';");
  expect(vitestEntrypointFile).toContain("import cases from './cases/basic.case.js';");
  expect(vitestEntrypointFile).toContain("import type { InsertUsersQuerySpecZtdCase } from './queryspec-ztd-types.js';");
  expect(vitestEntrypointFile).toContain('expect(cases.length).toBeGreaterThan(0);');
  expect(vitestEntrypointFile).toContain('await runQuerySpecZtdCases(cases, executeInsertUsersQuerySpec);');

  const testPlanFile = readFileSync(
    path.join(featureDir, 'insert-users', 'tests', 'generated', 'TEST_PLAN.md'),
    'utf8'
  );
  expect(testPlanFile).toContain('# users-insert / insert-users queryspec test plan');
  expect(testPlanFile).toContain('schemaVersion: 1');
  expect(testPlanFile).toContain('featureId: users-insert');
  expect(testPlanFile).toContain('testKind: ztd');
  expect(testPlanFile).toContain('resultCardinality: one');
  expect(testPlanFile).toContain('fixedVerifier: tests/ztd/harness.ts');
  expect(testPlanFile).toContain('vitestEntrypoint: src/features/users-insert/insert-users/tests/insert-users.queryspec.ztd.test.ts');
  expect(testPlanFile).toContain('generatedDir: src/features/users-insert/insert-users/tests/generated');
  expect(testPlanFile).toContain('casesDir: src/features/users-insert/insert-users/tests/cases');
  expect(testPlanFile).toContain('analysisJson: src/features/users-insert/insert-users/tests/generated/analysis.json');
  expect(testPlanFile).toContain('src/features/users-insert/entryspec.ts');
  expect(testPlanFile).toContain('src/features/users-insert/insert-users/queryspec.ts');
  expect(testPlanFile).toContain('src/features/users-insert/insert-users/insert-users.sql');
  expect(testPlanFile).toContain('Fixture Candidate Tables');
  expect(testPlanFile).toContain('- public.users');
  expect(testPlanFile).toContain('Write Tables');
  expect(testPlanFile).toContain('Validation Scenario Hints');
  expect(testPlanFile).toContain('DB Scenario Hints');
  expect(testPlanFile).toContain('After DB Semantics');
  expect(testPlanFile).toContain('- `afterDb` is optional and must be a pure fixture with schema-qualified table keys.');
  expect(testPlanFile).toContain('Row order is ignored, but row content must match exactly.');

  const analysisFile = JSON.parse(
    readFileSync(path.join(featureDir, 'insert-users', 'tests', 'generated', 'analysis.json'), 'utf8')
  ) as {
    schemaVersion: number;
    featureId: string;
    testKind: string;
    fixtureCandidateTables: string[];
    writesTables: string[];
    validationScenarioHints: string[];
    dbScenarioHints: string[];
    resultCardinality: string;
  };

  expect(analysisFile).toMatchObject({
    schemaVersion: 1,
    featureId: 'users-insert',
    testKind: 'ztd',
    fixtureCandidateTables: ['public.users'],
    writesTables: ['public.users'],
    validationScenarioHints: expect.arrayContaining([
      'Keep entryspec validation separate from queryspec DB-backed execution.',
      'Validation failures belong in the feature-root mock test lane.'
    ]),
    dbScenarioHints: expect.arrayContaining([
      'Use the fixed app-level harness and query-local cases to keep the ZTD path thin.',
      'Keep db/input/output visible in the case file so the AI can fill the query contract without re-deriving the scaffold.'
    ]),
    resultCardinality: 'one'
  });
});

test('runFeatureTestsScaffoldCommand refreshes generated analysis without overwriting persistent cases', async () => {
  const workspace = createTempDir('feature-tests-cases');
  const featureDir = path.join(workspace, 'src', 'features', 'users-insert');
  const queryDir = path.join(featureDir, 'insert-users');
  const testsDir = path.join(queryDir, 'tests');
  const generatedDir = path.join(testsDir, 'generated');
  const casesDir = path.join(testsDir, 'cases');
  mkdirSync(queryDir, { recursive: true });
  mkdirSync(casesDir, { recursive: true });
  mkdirSync(generatedDir, { recursive: true });

  writeFileSync(
    path.join(featureDir, 'entryspec.ts'),
    [
      "import { z } from 'zod';",
      '',
      'const RequestSchema = z.object({',
      '  email: z.string()',
      '}).strict();',
      '',
      'export async function executeUsersInsertEntrySpec() {',
      '  return RequestSchema.parse({ email: "alice@example.com" });',
      '}'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(queryDir, 'queryspec.ts'),
    [
      "export async function executeInsertUsersQuerySpec() {",
      '  return { user_id: "placeholder" };',
      '}'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(queryDir, 'insert-users.sql'),
    'insert into public.users (email) values (:email) returning user_id;',
    'utf8'
  );

  const caseFile = path.join(casesDir, 'basic.case.ts');
  writeFileSync(caseFile, "export const marker = 'keep-me';\n", 'utf8');
  const entrypointFile = path.join(testsDir, 'insert-users.queryspec.ztd.test.ts');
  writeFileSync(entrypointFile, "export const entrypointMarker = 'keep-me';\n", 'utf8');

  await runFeatureTestsScaffoldCommand({
    feature: 'users-insert',
    rootDir: workspace,
    force: true
  });

  expect(readFileSync(caseFile, 'utf8')).toBe("export const marker = 'keep-me';\n");
  expect(readFileSync(entrypointFile, 'utf8')).toBe("export const entrypointMarker = 'keep-me';\n");
  expect(readFileSync(path.join(generatedDir, 'analysis.json'), 'utf8')).toContain('"schemaVersion": 1');
});
