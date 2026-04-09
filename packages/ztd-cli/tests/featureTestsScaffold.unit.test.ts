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

function seedSharedZtdSupport(workspace: string): void {
  const supportDir = path.join(workspace, 'tests', 'support', 'ztd');
  mkdirSync(supportDir, { recursive: true });
  writeFileSync(path.join(supportDir, 'harness.ts'), 'export async function runQuerySpecZtdCases() {}\n', 'utf8');
  writeFileSync(path.join(supportDir, 'case-types.ts'), 'export type QuerySpecZtdCase<A, B, C, D> = { beforeDb: A; input: B; output: C; afterDb?: D };\n', 'utf8');
}

function seedStableTestAliases(workspace: string): void {
  writeFileSync(
    path.join(workspace, 'package.json'),
    `${JSON.stringify({
      name: 'feature-tests-scaffold-test',
      private: true,
      type: 'module',
      imports: {
        '#tests/*.js': {
          types: './tests/*.ts',
          default: './tests/*.ts'
        }
      }
    }, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    path.join(workspace, 'tsconfig.json'),
    `${JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '#tests/*': ['tests/*']
        }
      }
    }, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    path.join(workspace, 'vitest.config.ts'),
    [
      "import { defineConfig } from 'vitest/config';",
      '',
      'export default defineConfig({',
      '  resolve: {',
      "    alias: { '#tests': '/virtual/tests' }",
      '  }',
      '});',
      ''
    ].join('\n'),
    'utf8'
  );
}

test('runFeatureTestsScaffoldCommand writes query-local ZTD scaffolds from the current feature files', async () => {
  const workspace = createTempDir('feature-tests-scaffold');
  const featureDir = path.join(workspace, 'src', 'features', 'users-insert');
  const queryDir = path.join(featureDir, 'queries', 'insert-users');
  mkdirSync(queryDir, { recursive: true });
  seedSharedZtdSupport(workspace);

  writeFileSync(
    path.join(featureDir, 'boundary.ts'),
    [
      "import { z } from 'zod';",
      '',
      'const RequestSchema = z.object({',
      '  email: z.string()',
      '}).strict();',
      '',
      'export async function executeUsersInsertBoundary() {',
      '  return RequestSchema.parse({ email: "alice@example.com" });',
      '}'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(queryDir, 'boundary.ts'),
    [
      "export async function executeInsertUsersBoundary() {",
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
      'src/features/users-insert/queries/insert-users/tests',
      'src/features/users-insert/queries/insert-users/tests/generated',
      'src/features/users-insert/queries/insert-users/tests/cases',
      'src/features/users-insert/queries/insert-users/tests/insert-users.boundary.ztd.test.ts',
      'src/features/users-insert/queries/insert-users/tests/cases/basic.case.ts',
      'src/features/users-insert/queries/insert-users/tests/generated/TEST_PLAN.md',
      'src/features/users-insert/queries/insert-users/tests/generated/analysis.json'
    ])
  );

  const vitestEntrypointFile = readFileSync(
    path.join(featureDir, 'queries', 'insert-users', 'tests', 'insert-users.boundary.ztd.test.ts'),
    'utf8'
  );
  expect(vitestEntrypointFile).toContain("import { expect, test } from 'vitest';");
  expect(vitestEntrypointFile).toContain("import { runQuerySpecZtdCases } from '../../../../../../tests/support/ztd/harness.js';");
  expect(vitestEntrypointFile).toContain("import { executeBoundaryQuerySpec } from '../boundary.js';");
  expect(vitestEntrypointFile).toContain("import cases from './cases/basic.case.js';");
  expect(vitestEntrypointFile).toContain("import type { InsertUsersQueryBoundaryZtdCase } from './boundary-ztd-types.js';");
  expect(vitestEntrypointFile).toContain('expect(cases.length).toBeGreaterThan(0);');
  expect(vitestEntrypointFile).toContain('await runQuerySpecZtdCases(cases, executeBoundaryQuerySpec);');

  const queryTypesFile = readFileSync(
    path.join(featureDir, 'queries', 'insert-users', 'tests', 'boundary-ztd-types.ts'),
    'utf8'
  );
  expect(queryTypesFile).toContain('export type InsertUsersBeforeDb = { public: { users: readonly { email?: unknown }[] } };');
  expect(queryTypesFile).toContain('export type InsertUsersInput = { email: unknown };');
  expect(queryTypesFile).toContain('export type InsertUsersOutput = Record<string, unknown>;');
  expect(queryTypesFile).toContain("import type { QuerySpecZtdCase } from '../../../../../../tests/support/ztd/case-types.js';");
  expect(queryTypesFile).not.toContain('InsertUsersBeforeDb = Record<string, unknown>');

  const testPlanFile = readFileSync(
    path.join(featureDir, 'queries', 'insert-users', 'tests', 'generated', 'TEST_PLAN.md'),
    'utf8'
  );
  expect(testPlanFile).toContain('# users-insert / insert-users boundary test plan');
  expect(testPlanFile).toContain('schemaVersion: 1');
  expect(testPlanFile).toContain('featureId: users-insert');
  expect(testPlanFile).toContain('testKind: ztd');
  expect(testPlanFile).toContain('resultCardinality: one');
  expect(testPlanFile).toContain('fixedVerifier: tests/support/ztd/harness.ts');
  expect(testPlanFile).toContain('vitestEntrypoint: src/features/users-insert/queries/insert-users/tests/insert-users.boundary.ztd.test.ts');
  expect(testPlanFile).toContain('generatedDir: src/features/users-insert/queries/insert-users/tests/generated');
  expect(testPlanFile).toContain('casesDir: src/features/users-insert/queries/insert-users/tests/cases');
  expect(testPlanFile).toContain('analysisJson: src/features/users-insert/queries/insert-users/tests/generated/analysis.json');
  expect(testPlanFile).toContain('src/features/users-insert/boundary.ts');
  expect(testPlanFile).toContain('src/features/users-insert/queries/insert-users/boundary.ts');
  expect(testPlanFile).toContain('src/features/users-insert/queries/insert-users/insert-users.sql');
  expect(testPlanFile).toContain('Fixture Candidate Tables');
  expect(testPlanFile).toContain('- public.users');
  expect(testPlanFile).toContain('Write Tables');
  expect(testPlanFile).toContain('Validation Scenario Hints');
  expect(testPlanFile).toContain('DB Scenario Hints');
  expect(testPlanFile).toContain('After DB Semantics');
  expect(testPlanFile).toContain('- `afterDb` is optional and must be a pure fixture with schema-qualified table keys.');
  expect(testPlanFile).toContain('unordered multiset');
  expect(testPlanFile).toContain('subset-based per-row matching');
  expect(testPlanFile).toContain('Row order is ignored');
  expect(testPlanFile).toContain('restart identity cascade');

  const analysisFile = JSON.parse(
    readFileSync(path.join(featureDir, 'queries', 'insert-users', 'tests', 'generated', 'analysis.json'), 'utf8')
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
      'Keep feature-boundary validation separate from query-boundary DB-backed execution.',
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
  const queryDir = path.join(featureDir, 'queries', 'insert-users');
  const testsDir = path.join(queryDir, 'tests');
  const generatedDir = path.join(testsDir, 'generated');
  const casesDir = path.join(testsDir, 'cases');
  mkdirSync(queryDir, { recursive: true });
  mkdirSync(casesDir, { recursive: true });
  mkdirSync(generatedDir, { recursive: true });
  seedSharedZtdSupport(workspace);

  writeFileSync(
    path.join(featureDir, 'boundary.ts'),
    [
      "import { z } from 'zod';",
      '',
      'const RequestSchema = z.object({',
      '  email: z.string()',
      '}).strict();',
      '',
      'export async function executeUsersInsertBoundary() {',
      '  return RequestSchema.parse({ email: "alice@example.com" });',
      '}'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    path.join(queryDir, 'boundary.ts'),
    [
      "export async function executeInsertUsersBoundary() {",
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
  const entrypointFile = path.join(testsDir, 'insert-users.boundary.ztd.test.ts');
  writeFileSync(entrypointFile, "export const entrypointMarker = 'keep-me';\n", 'utf8');
  const queryTypesFile = path.join(testsDir, 'boundary-ztd-types.ts');
  writeFileSync(queryTypesFile, "export const queryTypesMarker = 'refresh-me';\n", 'utf8');

  await runFeatureTestsScaffoldCommand({
    feature: 'users-insert',
    rootDir: workspace,
    force: true
  });

  expect(readFileSync(caseFile, 'utf8')).toBe("export const marker = 'keep-me';\n");
  expect(readFileSync(entrypointFile, 'utf8')).toBe("export const entrypointMarker = 'keep-me';\n");
  expect(readFileSync(queryTypesFile, 'utf8')).not.toBe("export const queryTypesMarker = 'refresh-me';\n");
  expect(readFileSync(path.join(generatedDir, 'analysis.json'), 'utf8')).toContain('"schemaVersion": 1');
});

test('runFeatureTestsScaffoldCommand uses stable shared test imports when the workspace supports #tests', async () => {
  const workspace = createTempDir('feature-tests-stable-imports');
  const featureDir = path.join(workspace, 'src', 'features', 'users-insert');
  const queryDir = path.join(featureDir, 'queries', 'insert-users');
  mkdirSync(queryDir, { recursive: true });
  seedSharedZtdSupport(workspace);
  seedStableTestAliases(workspace);

  writeFileSync(path.join(featureDir, 'boundary.ts'), 'export const RequestSchema = null;\n', 'utf8');
  writeFileSync(path.join(queryDir, 'boundary.ts'), 'export async function executeInsertUsersBoundary() { return {}; }\n', 'utf8');
  writeFileSync(path.join(queryDir, 'insert-users.sql'), 'select 1;', 'utf8');

  await runFeatureTestsScaffoldCommand({
    feature: 'users-insert',
    rootDir: workspace
  });

  const vitestEntrypointFile = readFileSync(
    path.join(featureDir, 'queries', 'insert-users', 'tests', 'insert-users.boundary.ztd.test.ts'),
    'utf8'
  );
  expect(vitestEntrypointFile).toContain("import { runQuerySpecZtdCases } from '#tests/support/ztd/harness.js';");

  const queryTypesFile = readFileSync(
    path.join(featureDir, 'queries', 'insert-users', 'tests', 'boundary-ztd-types.ts'),
    'utf8'
  );
  expect(queryTypesFile).toContain("import type { QuerySpecZtdCase } from '#tests/support/ztd/case-types.js';");
});

test('runFeatureTestsScaffoldCommand fails fast when #tests alias support is partial', async () => {
  const workspace = createTempDir('feature-tests-partial-import-alias');
  const featureDir = path.join(workspace, 'src', 'features', 'users-insert');
  const queryDir = path.join(featureDir, 'queries', 'insert-users');
  mkdirSync(queryDir, { recursive: true });
  seedSharedZtdSupport(workspace);
  writeFileSync(
    path.join(workspace, 'package.json'),
    `${JSON.stringify({
      name: 'feature-tests-scaffold-test',
      private: true,
      type: 'module',
      imports: {
        '#tests/*.js': {
          types: './tests/*.ts',
          default: './tests/*.ts'
        }
      }
    }, null, 2)}\n`,
    'utf8'
  );

  writeFileSync(path.join(featureDir, 'boundary.ts'), 'export const RequestSchema = null;\n', 'utf8');
  writeFileSync(path.join(queryDir, 'boundary.ts'), 'export async function executeInsertUsersBoundary() { return {}; }\n', 'utf8');
  writeFileSync(path.join(queryDir, 'insert-users.sql'), 'select 1;', 'utf8');

  await expect(
    runFeatureTestsScaffoldCommand({
      feature: 'users-insert',
      rootDir: workspace
    })
  ).rejects.toThrow(/partial #tests alias configuration/i);
});

test('runFeatureTestsScaffoldCommand fails fast when starter-owned ZTD support is missing', async () => {
  const workspace = createTempDir('feature-tests-missing-support');
  const featureDir = path.join(workspace, 'src', 'features', 'users-insert');
  const queryDir = path.join(featureDir, 'queries', 'insert-users');
  mkdirSync(queryDir, { recursive: true });

  writeFileSync(path.join(featureDir, 'boundary.ts'), 'export const RequestSchema = null;\n', 'utf8');
  writeFileSync(path.join(queryDir, 'boundary.ts'), 'export async function executeInsertUsersBoundary() { return {}; }\n', 'utf8');
  writeFileSync(path.join(queryDir, 'insert-users.sql'), 'select 1;', 'utf8');

  await expect(
    runFeatureTestsScaffoldCommand({
      feature: 'users-insert',
      rootDir: workspace
    })
  ).rejects.toThrow(/tests\/support\/ztd/);
});
