import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  assessGeneratedMetadataCapability,
  deriveFeatureName,
  normalizeFeatureAction,
  normalizeFeatureName,
  resolveFeatureScaffoldInput,
  resolvePrimaryKeyColumn,
  runFeatureScaffoldCommand
} from '../src/commands/feature';
import { DEFAULT_ZTD_CONFIG } from '../src/utils/ztdProjectConfig';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');
function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

test('deriveFeatureName defaults to resource-action form', () => {
  expect(deriveFeatureName('users', 'insert')).toBe('users-insert');
  expect(deriveFeatureName('public.users', 'insert')).toBe('users-insert');
});

test('normalizeFeatureAction only accepts insert in v1', () => {
  expect(normalizeFeatureAction('insert')).toBe('insert');
  expect(() => normalizeFeatureAction('update')).toThrow(/supports only insert/i);
});

test('normalizeFeatureName enforces resource-action kebab-case', () => {
  expect(normalizeFeatureName('users-insert')).toBe('users-insert');
  expect(() => normalizeFeatureName('users')).toThrow(/resource-action/i);
});

test('generated metadata assessment reports missing PK contract even when manifest exists', () => {
  const workspace = createTempDir('feature-scaffold-manifest');
  const generatedDir = path.join(workspace, 'tests', 'generated');
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(
    path.join(generatedDir, 'ztd-fixture-manifest.generated.ts'),
    [
      'export const tableDefinitions = [',
      '  {',
      '    name: "public.users",',
      '    columns: [{ name: "id", typeName: "serial", defaultValue: null, isNotNull: true }]',
      '  }',
      '];'
    ].join('\n'),
    'utf8'
  );

  const assessment = assessGeneratedMetadataCapability(workspace);
  expect(assessment.supported).toBe(false);
  expect(assessment.reasons.join('\n')).toMatch(/primary key identity/i);
  expect(assessment.reasons.join('\n')).toMatch(/composite primary key/i);
});

test('resolveFeatureScaffoldInput falls back to ddl metadata and resolves schema-qualified names', () => {
  const workspace = createTempDir('feature-scaffold-ddl');
  const ddlDir = path.join(workspace, 'ztd', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null,',
      '  created_at timestamptz not null default now()',
      ');'
    ].join('\n'),
    'utf8'
  );

  const input = resolveFeatureScaffoldInput({
    projectRoot: workspace,
    table: 'users',
    config: DEFAULT_ZTD_CONFIG,
    generatedMetadataAssessment: {
      source: 'generated-metadata',
      supported: false,
      reasons: ['pk metadata missing'],
      checkedFiles: []
    }
  });

  expect(input.source).toBe('ddl');
  expect(input.table.canonicalName).toBe('public.users');
  expect(input.table.columns.map((column) => column.name)).toEqual(['id', 'email', 'created_at']);
});

test('resolvePrimaryKeyColumn rejects missing and composite primary keys', () => {
  expect(() =>
    resolvePrimaryKeyColumn({
      canonicalName: 'public.users',
      schemaName: 'public',
      tableName: 'users',
      primaryKeyColumns: [],
      columns: []
    })
  ).toThrow(/exactly one primary key/i);

  expect(() =>
    resolvePrimaryKeyColumn({
      canonicalName: 'public.users',
      schemaName: 'public',
      tableName: 'users',
      primaryKeyColumns: ['tenant_id', 'id'],
      columns: []
    })
  ).toThrow(/composite primary keys/i);
});

test('runFeatureScaffoldCommand dry-run creates the fixed layout plan without test files', async () => {
  const workspace = createTempDir('feature-scaffold-dry-run');
  const ddlDir = path.join(workspace, 'ztd', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null,',
      '  created_at timestamptz not null default now()',
      ');'
    ].join('\n'),
    'utf8'
  );

  const result = await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    dryRun: true,
    rootDir: workspace
  });

  expect(result.featureName).toBe('users-insert');
  expect(result.primaryKeyColumn).toBe('id');
  expect(result.source).toBe('ddl');
  expect(result.outputs.map((output) => output.path)).toEqual(expect.arrayContaining([
    'src/features/_shared',
    'src/features/_shared/loadSqlResource.ts',
    'src/features/_shared/queryOneExact.ts',
    'src/features/users-insert',
    'src/features/users-insert/sql/users-insert.sql',
    'src/features/users-insert/README.md'
  ]));
  expect(result.outputs.some((output) => output.path.endsWith('.queryspec.test.ts'))).toBe(false);
  expect(result.outputs.some((output) => output.path.endsWith('.feature.test.ts'))).toBe(false);
});

test('runFeatureScaffoldCommand writes a file-resource entrypoint and scaffold README contract', async () => {
  const workspace = createTempDir('feature-scaffold-write-contract');
  const ddlDir = path.join(workspace, 'ztd', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null,',
      '  created_at timestamptz not null default now()',
      ');'
    ].join('\n'),
    'utf8'
  );

  const result = await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    rootDir: workspace
  });

  expect(result.dryRun).toBe(false);

  const featureFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'users-insert.ts'),
    'utf8'
  );
  expect(featureFile).toContain("import { loadSqlResource } from '../_shared/loadSqlResource';");
  expect(featureFile).toContain("import { queryOneExact, type FeatureQueryExecutor } from '../_shared/queryOneExact';");
  expect(featureFile).toContain("const usersInsertSqlResource = loadSqlResource(__dirname, 'sql/users-insert.sql');");
  expect(featureFile).toContain('export interface UsersInsertInput {');
  expect(featureFile).toContain('  id: unknown;');
  expect(featureFile).toContain('  email: unknown;');
  expect(featureFile).toContain('  created_at: unknown;');
  expect(featureFile).toContain("return queryOneExact<UsersInsertResult>(executor, usersInsertSqlResource, input, 'users-insert');");
  expect(featureFile).not.toContain("TODO: implement feature entrypoint.");
  expect(featureFile).not.toContain("readFileSync(path.join(__dirname, 'sql', 'users-insert.sql'), 'utf8')");

  const loadSqlResourceFile = readFileSync(
    path.join(workspace, 'src', 'features', '_shared', 'loadSqlResource.ts'),
    'utf8'
  );
  expect(loadSqlResourceFile).toContain("import { readFileSync } from 'node:fs';");
  expect(loadSqlResourceFile).toContain('export function loadSqlResource(currentDir: string, relativePath: string): string {');

  const queryOneExactFile = readFileSync(
    path.join(workspace, 'src', 'features', '_shared', 'queryOneExact.ts'),
    'utf8'
  );
  expect(queryOneExactFile).toContain('export interface FeatureQueryExecutor {');
  expect(queryOneExactFile).toContain('export async function queryOneExact<TResult>(');
  expect(queryOneExactFile).toContain('Expected exactly one row from ${label}, received none.');
  expect(queryOneExactFile).toContain('Expected exactly one row from ${label}, received ${rows.length}.');

  const readmeFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'README.md'),
    'utf8'
  );
  expect(readmeFile).toContain('## Execution seam contract');
  expect(readmeFile).toContain('Keep `sql/users-insert.sql` as the SQL file resource.');
  expect(readmeFile).toContain("Do not inline SQL text into `users-insert.ts`.");
  expect(readmeFile).toContain('Load the SQL file resource through `src/features/_shared/loadSqlResource.ts`.');
  expect(readmeFile).toContain('Execute the one-row path through `src/features/_shared/queryOneExact.ts`.');
  expect(readmeFile).toContain('Expect exactly one row from the executor.');
  expect(readmeFile).toContain('## Open questions');
  expect(readmeFile).toContain('Consider lazy-loading or caching the SQL file resource if repeated imports become a concern.');
});
