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

test('runFeatureTestsScaffoldCommand writes TODO-based test scaffolds from the current feature files', async () => {
  const workspace = createTempDir('feature-tests-scaffold');
  const featureDir = path.join(workspace, 'src', 'features', 'users-insert');
  const queryDir = path.join(featureDir, 'insert-users');
  mkdirSync(queryDir, { recursive: true });

  writeFileSync(
    path.join(featureDir, 'entryspec.ts'),
    [
      "export async function executeUsersInsertEntrySpec() {",
      '  return { user_id: "placeholder" };',
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
      'src/features/users-insert/tests',
      'src/features/users-insert/tests/ztd',
      'src/features/users-insert/tests/ztd/generated',
      'src/features/users-insert/tests/ztd/cases',
      'src/features/users-insert/tests/ztd/generated/TEST_PLAN.md',
      'src/features/users-insert/tests/ztd/generated/analysis.json'
    ])
  );

  const testPlanFile = readFileSync(path.join(featureDir, 'tests', 'ztd', 'generated', 'TEST_PLAN.md'), 'utf8');
  expect(testPlanFile).toContain('# users-insert test plan');
  expect(testPlanFile).toContain('schemaVersion: 1');
  expect(testPlanFile).toContain('featureId: users-insert');
  expect(testPlanFile).toContain('testKind: ztd');
  expect(testPlanFile).toContain('resultCardinality: one');
  expect(testPlanFile).toContain('fixedVerifier: tests/ztd/harness.ts');
  expect(testPlanFile).toContain('persistentCases: src/features/users-insert/tests/ztd/cases');
  expect(testPlanFile).toContain('analysisJson: src/features/users-insert/tests/ztd/generated/analysis.json');
  expect(testPlanFile).toContain('src/features/users-insert/entryspec.ts');
  expect(testPlanFile).toContain('src/features/users-insert/insert-users/queryspec.ts');
  expect(testPlanFile).toContain('src/features/users-insert/insert-users/insert-users.sql');
  expect(testPlanFile).toContain('Fixture Candidate Tables');
  expect(testPlanFile).toContain('- public.users');
  expect(testPlanFile).toContain('Write Tables');
  expect(testPlanFile).toContain('Validation Scenario Hints');
  expect(testPlanFile).toContain('DB Scenario Hints');

  const analysisFile = JSON.parse(
    readFileSync(path.join(featureDir, 'tests', 'ztd', 'generated', 'analysis.json'), 'utf8')
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
      'Missing required request fields should fail at the feature boundary.',
      'Malformed feature input should never reach the fixed verifier.'
    ]),
    dbScenarioHints: expect.arrayContaining([
      'Keep the success path DB-backed through the fixed app-level verifier.',
      'Expect one row or one inserted result for a non-list feature.'
    ]),
    resultCardinality: 'one'
  });
});

test('runFeatureTestsScaffoldCommand refreshes generated analysis without overwriting persistent cases', async () => {
  const workspace = createTempDir('feature-tests-cases');
  const featureDir = path.join(workspace, 'src', 'features', 'users-insert');
  const queryDir = path.join(featureDir, 'insert-users');
  const casesDir = path.join(featureDir, 'tests', 'ztd', 'cases');
  mkdirSync(queryDir, { recursive: true });
  mkdirSync(casesDir, { recursive: true });

  writeFileSync(
    path.join(featureDir, 'entryspec.ts'),
    [
      "export async function executeUsersInsertEntrySpec() {",
      '  return { user_id: "placeholder" };',
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

  const caseFile = path.join(casesDir, 'basic-success.case.ts');
  writeFileSync(caseFile, "export const marker = 'keep-me';\n", 'utf8');

  await runFeatureTestsScaffoldCommand({
    feature: 'users-insert',
    rootDir: workspace,
    force: true
  });

  expect(readFileSync(caseFile, 'utf8')).toBe("export const marker = 'keep-me';\n");
  expect(readFileSync(path.join(featureDir, 'tests', 'ztd', 'generated', 'analysis.json'), 'utf8')).toContain('"schemaVersion": 1');
});
