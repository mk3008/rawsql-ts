import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  assessGeneratedMetadataCapability,
  deriveFeatureName,
  normalizeChildQueryName,
  normalizeFeatureAction,
  normalizeFeatureName,
  normalizeInsertDefaultPolicy,
  resolveFeatureScaffoldInput,
  resolvePrimaryKeyColumn,
  runExistingBoundaryQueryScaffoldCommand,
  runFeatureGeneratedMapperCheckCommand,
  runFeatureGeneratedMapperGenerateCommand,
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

function seedStableFeatureAliases(workspace: string): void {
  writeFileSync(
    path.join(workspace, 'package.json'),
    `${JSON.stringify({
      name: 'feature-scaffold-test',
      private: true,
      type: 'module',
      imports: {
        '#features/*.js': {
          types: './src/features/*.ts',
          default: './dist/features/*.js'
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
          '#features/*': ['src/features/*']
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
      "    alias: { '#features': '/virtual/src/features' }",
      '  }',
      '});',
      ''
    ].join('\n'),
    'utf8'
  );
}

test('deriveFeatureName defaults to resource-action form', () => {
  expect(deriveFeatureName('users', 'insert')).toBe('users-insert');
  expect(deriveFeatureName('users', 'update')).toBe('users-update');
  expect(deriveFeatureName('users', 'delete')).toBe('users-delete');
  expect(deriveFeatureName('users', 'get-by-id')).toBe('users-get-by-id');
  expect(deriveFeatureName('users', 'list')).toBe('users-list');
  expect(deriveFeatureName('public.users', 'insert')).toBe('users-insert');
  expect(deriveFeatureName('crm.UserProfiles', 'insert')).toBe('user-profiles-insert');
  expect(deriveFeatureName('public.user_profiles', 'insert')).toBe('user-profiles-insert');
  expect(deriveFeatureName('public.user profiles', 'insert')).toBe('user-profiles-insert');
});

test('normalizeFeatureAction accepts the supported CRUD scaffold actions', () => {
  expect(normalizeFeatureAction('insert')).toBe('insert');
  expect(normalizeFeatureAction('update')).toBe('update');
  expect(normalizeFeatureAction('delete')).toBe('delete');
  expect(normalizeFeatureAction('get-by-id')).toBe('get-by-id');
  expect(normalizeFeatureAction('list')).toBe('list');
  expect(() => normalizeFeatureAction('read')).toThrow(/supports only insert, update, delete, get-by-id, and list/i);
});

test('normalizeInsertDefaultPolicy accepts only documented INSERT default policies', () => {
  expect(normalizeInsertDefaultPolicy(undefined)).toBe('explicit-defaults');
  expect(normalizeInsertDefaultPolicy('explicit-defaults')).toBe('explicit-defaults');
  expect(normalizeInsertDefaultPolicy('omit-db-defaults')).toBe('omit-db-defaults');
  expect(() => normalizeInsertDefaultPolicy('implicit')).toThrow(/explicit-defaults and omit-db-defaults/i);
});

test('normalizeFeatureName enforces resource-action kebab-case', () => {
  expect(normalizeFeatureName('users-insert')).toBe('users-insert');
  expect(() => normalizeFeatureName('users')).toThrow(/resource-action/i);
  expect(() => normalizeFeatureName('3users-insert')).toThrow(/start with a letter/i);
});

test('normalizeChildQueryName enforces kebab-case child-boundary names', () => {
  expect(normalizeChildQueryName('insert-sales-detail')).toBe('insert-sales-detail');
  expect(() => normalizeChildQueryName('insert_sales_detail')).toThrow(/kebab-case/i);
  expect(() => normalizeChildQueryName('3-insert-sales-detail')).toThrow(/start with a letter/i);
});

test('generated metadata assessment reports missing PK contract even when manifest exists', () => {
  const workspace = createTempDir('feature-scaffold-manifest');
  const generatedDir = path.join(workspace, '.ztd', 'generated');
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
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial8 primary key,',
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

test('resolveFeatureScaffoldInput honors searchPath order when schemas share a table name', () => {
  const workspace = createTempDir('feature-scaffold-search-path');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'tables.sql'),
    [
      'create table public.users (',
      '  id serial primary key',
      ');',
      '',
      'create table app.users (',
      '  id serial primary key',
      ');'
    ].join('\n'),
    'utf8'
  );

  const input = resolveFeatureScaffoldInput({
    projectRoot: workspace,
    table: 'users',
    config: {
      ...DEFAULT_ZTD_CONFIG,
      searchPath: ['app', 'public']
    },
    generatedMetadataAssessment: {
      source: 'generated-metadata',
      supported: false,
      reasons: ['pk metadata missing'],
      checkedFiles: []
    }
  });

  expect(input.table.canonicalName).toBe('app.users');
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

test('runExistingBoundaryQueryScaffoldCommand dry-run plans an additive query under an existing feature boundary', async () => {
  const workspace = createTempDir('feature-query-scaffold-dry-run');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const featureDir = path.join(workspace, 'src', 'features', 'sales-insert');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(featureDir, { recursive: true });
  writeFileSync(path.join(featureDir, 'boundary.ts'), '// existing parent boundary\n', 'utf8');
  writeFileSync(
    path.join(ddlDir, 'sales_detail.sql'),
    [
      'create table public.sales_detail (',
      '  id serial primary key,',
      '  sales_id integer not null,',
      '  amount numeric not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  const result = await runExistingBoundaryQueryScaffoldCommand({
    feature: 'sales-insert',
    table: 'sales_detail',
    action: 'insert',
    queryName: 'insert-sales-detail',
    dryRun: true,
    rootDir: workspace
  });

  expect(result.boundaryPath).toBe('src/features/sales-insert');
  expect(result.resolutionSource).toBe('feature');
  const plannedPaths = result.outputs.map((output) => output.path);
  expect(plannedPaths).toEqual(expect.arrayContaining([
    'src/features/sales-insert/queries',
    'src/features/sales-insert/queries/insert-sales-detail',
    'src/features/sales-insert/queries/insert-sales-detail/generated',
    'src/features/sales-insert/queries/insert-sales-detail/boundary.ts',
    'src/features/sales-insert/queries/insert-sales-detail/insert-sales-detail.sql',
    'src/features/sales-insert/queries/insert-sales-detail/generated/row-mapper.ts'
  ]));
  expect(plannedPaths).not.toContain('src/features/sales-insert/boundary.ts');
});

test('runExistingBoundaryQueryScaffoldCommand writes a child query boundary without touching the parent boundary', async () => {
  const workspace = createTempDir('feature-query-scaffold-write');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const featureDir = path.join(workspace, 'src', 'features', 'sales-insert');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(featureDir, { recursive: true });
  const parentBoundary = path.join(featureDir, 'boundary.ts');
  writeFileSync(parentBoundary, '// existing parent boundary\n', 'utf8');
  writeFileSync(
    path.join(ddlDir, 'sales_detail.sql'),
    [
      'create table public.sales_detail (',
      '  id serial primary key,',
      '  sales_id integer not null,',
      '  amount numeric not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  await runExistingBoundaryQueryScaffoldCommand({
    boundaryDir: path.join('src', 'features', 'sales-insert'),
    table: 'sales_detail',
    action: 'insert',
    queryName: 'insert-sales-detail',
    rootDir: workspace
  });

  expect(readFileSync(parentBoundary, 'utf8')).toBe('// existing parent boundary\n');
  expect(existsSync(path.join(featureDir, 'queries', 'insert-sales-detail', 'boundary.ts'))).toBe(true);
  expect(existsSync(path.join(featureDir, 'queries', 'insert-sales-detail', 'insert-sales-detail.sql'))).toBe(true);
  expect(existsSync(path.join(featureDir, 'queries', 'insert-sales-detail', 'generated', 'row-mapper.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', '_shared', 'featureQueryExecutor.ts'))).toBe(true);
  expect(existsSync(path.join(workspace, 'src', 'features', '_shared', 'loadSqlResource.ts'))).toBe(true);
  expect(existsSync(path.join(featureDir, 'README.md'))).toBe(false);
});

test('runExistingBoundaryQueryScaffoldCommand renders dynamic shared imports for nested boundaries', async () => {
  const workspace = createTempDir('feature-query-scaffold-nested');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const boundaryDir = path.join(workspace, 'src', 'features', 'orders', 'write', 'sales-insert');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(boundaryDir, { recursive: true });
  writeFileSync(path.join(boundaryDir, 'boundary.ts'), '// nested parent boundary\n', 'utf8');
  writeFileSync(
    path.join(ddlDir, 'sales_detail.sql'),
    [
      'create table public.sales_detail (',
      '  id serial primary key,',
      '  sales_id integer not null,',
      '  amount numeric not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  await runExistingBoundaryQueryScaffoldCommand({
    boundaryDir: path.join('src', 'features', 'orders', 'write', 'sales-insert'),
    table: 'sales_detail',
    action: 'insert',
    queryName: 'insert-sales-detail',
    rootDir: workspace
  });

  const querySpecFile = readFileSync(
    path.join(boundaryDir, 'queries', 'insert-sales-detail', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).toContain("import type { FeatureQueryExecutor } from '../../../../../_shared/featureQueryExecutor.js';");
  expect(querySpecFile).toContain("import { loadSqlResource } from '../../../../../_shared/loadSqlResource.js';");
});

test('runExistingBoundaryQueryScaffoldCommand fails fast when the parent boundary contract is invalid', async () => {
  const workspace = createTempDir('feature-query-scaffold-invalid-boundary');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const boundaryDir = path.join(workspace, 'src', 'features', 'sales-insert');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(boundaryDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'sales_detail.sql'),
    [
      'create table public.sales_detail (',
      '  id serial primary key,',
      '  sales_id integer not null,',
      '  amount numeric not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  await expect(
    runExistingBoundaryQueryScaffoldCommand({
      boundaryDir: path.join('src', 'features', 'sales-insert'),
      table: 'sales_detail',
      action: 'insert',
      queryName: 'insert-sales-detail',
      rootDir: workspace
    })
  ).rejects.toThrow(/must contain boundary\.ts/i);
});

test('runExistingBoundaryQueryScaffoldCommand fails fast when the target boundary does not exist', async () => {
  const workspace = createTempDir('feature-query-scaffold-missing-boundary');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'sales_detail.sql'),
    [
      'create table public.sales_detail (',
      '  id serial primary key,',
      '  sales_id integer not null,',
      '  amount numeric not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  await expect(
    runExistingBoundaryQueryScaffoldCommand({
      boundaryDir: path.join('src', 'features', 'sales-insert'),
      table: 'sales_detail',
      action: 'insert',
      queryName: 'insert-sales-detail',
      rootDir: workspace
    })
  ).rejects.toThrow(/Existing boundary folder not found/i);
});

test('runExistingBoundaryQueryScaffoldCommand fails fast when the target boundary is not a directory', async () => {
  const workspace = createTempDir('feature-query-scaffold-file-boundary');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const boundaryFile = path.join(workspace, 'src', 'features', 'sales-insert');
  mkdirSync(path.dirname(boundaryFile), { recursive: true });
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(boundaryFile, 'not a directory\n', 'utf8');
  writeFileSync(
    path.join(ddlDir, 'sales_detail.sql'),
    [
      'create table public.sales_detail (',
      '  id serial primary key,',
      '  sales_id integer not null,',
      '  amount numeric not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  await expect(
    runExistingBoundaryQueryScaffoldCommand({
      boundaryDir: path.join('src', 'features', 'sales-insert'),
      table: 'sales_detail',
      action: 'insert',
      queryName: 'insert-sales-detail',
      rootDir: workspace
    })
  ).rejects.toThrow(/Boundary target must be a directory/i);
});

test('runExistingBoundaryQueryScaffoldCommand fails fast when queries is not a directory', async () => {
  const workspace = createTempDir('feature-query-scaffold-invalid-queries');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const featureDir = path.join(workspace, 'src', 'features', 'sales-insert');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(featureDir, { recursive: true });
  writeFileSync(path.join(featureDir, 'boundary.ts'), '// existing parent boundary\n', 'utf8');
  writeFileSync(
    path.join(ddlDir, 'sales_detail.sql'),
    [
      'create table public.sales_detail (',
      '  id serial primary key,',
      '  sales_id integer not null,',
      '  amount numeric not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  writeFileSync(path.join(featureDir, 'queries'), 'not a directory\n', 'utf8');
  await expect(
    runExistingBoundaryQueryScaffoldCommand({
      boundaryDir: path.join('src', 'features', 'sales-insert'),
      table: 'sales_detail',
      action: 'insert',
      queryName: 'insert-sales-detail',
      rootDir: workspace
    })
  ).rejects.toThrow(/queries\/ to be a directory/i);
});

test('runExistingBoundaryQueryScaffoldCommand fails fast when the target query already exists', async () => {
  const workspace = createTempDir('feature-query-scaffold-existing-query');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const featureDir = path.join(workspace, 'src', 'features', 'sales-insert');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(path.join(featureDir, 'queries', 'insert-sales-detail'), { recursive: true });
  writeFileSync(path.join(featureDir, 'boundary.ts'), '// existing parent boundary\n', 'utf8');
  writeFileSync(
    path.join(ddlDir, 'sales_detail.sql'),
    [
      'create table public.sales_detail (',
      '  id serial primary key,',
      '  sales_id integer not null,',
      '  amount numeric not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  await expect(
    runExistingBoundaryQueryScaffoldCommand({
      boundaryDir: path.join('src', 'features', 'sales-insert'),
      table: 'sales_detail',
      action: 'insert',
      queryName: 'insert-sales-detail',
      rootDir: workspace
    })
  ).rejects.toThrow(/already exists/i);
});

test('runExistingBoundaryQueryScaffoldCommand rejects feature and boundaryDir together', async () => {
  const workspace = createTempDir('feature-query-scaffold-exclusive-flags');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const featureDir = path.join(workspace, 'src', 'features', 'sales-insert');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(featureDir, { recursive: true });
  writeFileSync(path.join(featureDir, 'boundary.ts'), '// existing parent boundary\n', 'utf8');
  writeFileSync(
    path.join(ddlDir, 'sales_detail.sql'),
    [
      'create table public.sales_detail (',
      '  id serial primary key,',
      '  sales_id integer not null,',
      '  amount numeric not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  await expect(
    runExistingBoundaryQueryScaffoldCommand({
      feature: 'sales-insert',
      boundaryDir: path.join('src', 'features', 'sales-insert'),
      table: 'sales_detail',
      action: 'insert',
      queryName: 'insert-sales-detail',
      rootDir: workspace
    })
  ).rejects.toThrow(/feature.*boundary-dir|boundary-dir.*feature|not both/i);
});

test('runFeatureScaffoldCommand dry-run creates the new insert layout without test files', async () => {
  const workspace = createTempDir('feature-scaffold-dry-run');
  const ddlDir = path.join(workspace, 'db', 'ddl');
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
    'src/features/_shared/featureQueryExecutor.ts',
    'src/features/_shared/loadSqlResource.ts',
    'src/features/users-insert',
    'src/features/users-insert/tests',
    'src/features/users-insert/tests/users-insert.boundary.test.ts',
    'src/features/users-insert/boundary.ts',
    'src/features/users-insert/input.ts',
    'src/features/users-insert/workflow.ts',
    'src/features/users-insert/output.ts',
    'src/features/users-insert/queries/insert-users',
    'src/features/users-insert/queries/insert-users/generated',
    'src/features/users-insert/queries/insert-users/boundary.ts',
    'src/features/users-insert/queries/insert-users/insert-users.sql',
    'src/features/users-insert/queries/insert-users/generated/row-mapper.ts',
    'src/features/users-insert/README.md'
  ]));
  expect(result.outputs.some((output) => output.path.endsWith('.boundary.ztd.test.ts'))).toBe(false);
  expect(result.outputs.some((output) => output.path.endsWith('.boundary.test.ts'))).toBe(true);
});

test('runFeatureScaffoldCommand writes the boundary baseline and excludes generated PK columns', async () => {
  const workspace = createTempDir('feature-scaffold-write-contract');
  const ddlDir = path.join(workspace, 'db', 'ddl');
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

  const entrySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'boundary.ts'),
    'utf8'
  );
  expect(entrySpecFile).toContain("import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';");
  expect(entrySpecFile).toContain("import * as input from './input.js';");
  expect(entrySpecFile).toContain("import * as workflow from './workflow.js';");
  expect(entrySpecFile).toContain("import * as output from './output.js';");
  expect(entrySpecFile).toContain('Review order:');
  expect(entrySpecFile).toContain('export async function execute(');
  expect(entrySpecFile).toContain('const request = input.parseRequest(rawRequest);');
  expect(entrySpecFile).toContain('const created = await workflow.execute(executor, request);');
  expect(entrySpecFile).toContain('return output.buildResult(created);');
  expect(entrySpecFile).not.toContain('QueryParamsSchema');
  expect(entrySpecFile).not.toContain('RequestSchema');

  const inputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'input.ts'),
    'utf8'
  );
  expect(inputFile).toContain("import { z } from 'zod';");
  expect(inputFile).toContain('const RequestSchema = z.object({');
  expect(inputFile).toContain('}).strict();');
  expect(inputFile).toContain('export type UsersInsertRequest = z.infer<typeof RequestSchema>;');
  expect(inputFile).toContain('/** Parses the raw feature request at the feature boundary. */');
  expect(inputFile).toContain('function parseRawRequest');
  expect(inputFile).toContain('/** Normalizes the parsed feature request for downstream feature logic. */');
  expect(inputFile).toContain('function normalizeRequest');
  expect(inputFile).toContain('email: request.email.trim()');
  expect(inputFile).toContain("throw new Error('UsersInsertRequest.email must not be empty after trim().');");
  expect(inputFile).toContain('export function parseRequest');
  expect(inputFile).not.toContain('QueryParamsSchema');
  expect(inputFile).not.toContain('ResponseSchema');
  expect(inputFile).not.toContain('id: z.string()');

  const workflowFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'workflow.ts'),
    'utf8'
  );
  expect(workflowFile).toContain('export type UsersInsertQueries = {');
  expect(workflowFile).toContain('executeInsertUsers: executeInsertUsersQuerySpec');
  expect(workflowFile).toContain('Query functions are injected for workflow tests');
  expect(workflowFile).toContain('SQL text that may be transformed by rewrite or pipeline processing');
  expect(workflowFile).toContain('/** Maps the feature request into query params for the query spec. */');
  expect(workflowFile).toContain('function toQueryParams');
  expect(workflowFile).toContain('return {');
  expect(workflowFile).toContain('email: request.email,');
  expect(workflowFile).not.toContain('id: request.id,');
  expect(workflowFile).not.toContain('created_at: request.created_at,');

  const outputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'output.ts'),
    'utf8'
  );
  expect(outputFile).toContain("import type { InsertUsersQueryResult } from './queries/insert-users/boundary.js';");
  expect(outputFile).toContain('export type UsersInsertResponse = {');
  expect(outputFile).toContain('export function buildResult');
  expect(outputFile).toContain('id: result.id,');
  expect(outputFile).not.toContain("import { z } from 'zod';");
  expect(outputFile).not.toContain('ResponseSchema');
  expect(entrySpecFile).not.toContain('UsersInsertRequest.id');
  expect(entrySpecFile).not.toContain('id: z.string()');
  expect(entrySpecFile).not.toContain('created_at: request.created_at.trim()');
  expect(entrySpecFile).not.toContain('UsersInsertRequest.created_at');
  expect(entrySpecFile).not.toContain('ScalarKind');
  expect(entrySpecFile).not.toContain('parseBySpecs');
  expect(entrySpecFile).not.toContain('expectObject');
  expect(entrySpecFile).not.toContain('matchesKind');

  const entrySpecTestFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'tests', 'users-insert.boundary.test.ts'),
    'utf8'
  );
  expect(entrySpecTestFile).toContain("import { expect, test } from 'vitest';");
  expect(entrySpecTestFile).toContain("import { execute } from '../boundary.js';");
  expect(entrySpecTestFile).toContain("import type { FeatureQueryExecutor } from '../../_shared/featureQueryExecutor.js';");
  expect(entrySpecTestFile).toContain('function createGuardedExecutor(): FeatureQueryExecutor');
  expect(entrySpecTestFile).toContain("test('rejects invalid feature input at the feature boundary for users-insert/insert-users', async () => {");
  expect(entrySpecTestFile).toContain('await expect(execute(createGuardedExecutor(), {})).rejects.toThrow();');
  expect(entrySpecTestFile).toContain("test.todo('cover normalization and response mapping for UsersInsert boundary');");

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'queries', 'insert-users', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).toContain("import { z } from 'zod';");
  expect(querySpecFile).toContain("import type { FeatureQueryExecutor } from '../../../_shared/featureQueryExecutor.js';");
  expect(querySpecFile).toContain("const insertUsersSqlResource = loadSqlResource(__dirname, 'insert-users.sql');");
  expect(querySpecFile).toContain("import { mapInsertUsersRowToResult } from './generated/row-mapper.js';");
  expect(querySpecFile).toContain('const QueryParamsSchema = z.object({');
  expect(querySpecFile).toContain("}).strict();");
  expect(querySpecFile).toContain("email: z.string().min(1, 'email must not be empty.')");
  expect(querySpecFile).not.toContain("id: z.string().min(1, 'id must not be empty.')");
  expect(querySpecFile).not.toContain('created_at: z.string().min(1');
  expect(querySpecFile).toContain('export type InsertUsersQueryParams = z.infer<typeof QueryParamsSchema>;');
  expect(querySpecFile).toContain('export type InsertUsersRow = z.infer<typeof RowSchema>;');
  expect(querySpecFile).toContain('export type InsertUsersQueryResult = z.infer<typeof QueryResultSchema>;');
  expect(querySpecFile).toContain('/** Parses raw query params at the query boundary. */');
  expect(querySpecFile).toContain('function parseQueryParams');
  expect(querySpecFile).toContain('/** Parses a raw DB row at the query boundary. */');
  expect(querySpecFile).toContain('function parseRow');
  expect(querySpecFile).not.toContain('function mapRowToResult');
  expect(querySpecFile).toContain('/** Executes the query boundary flow for this query spec. */');
  expect(querySpecFile).toContain('export async function executeInsertUsersQuerySpec');
  expect(querySpecFile).toContain('loadSingleRow');
  expect(querySpecFile).toContain('return mapInsertUsersRowToResult(row);');
  expect(querySpecFile).toContain('executor.query<Record<string, unknown>>(sql, params)');
  expect(querySpecFile).not.toContain('export interface InsertUsersQueryContract');
  expect(querySpecFile).not.toContain('export const insertUsersQueryContract');
  expect(querySpecFile).not.toContain('export function parseInsertUsersQueryParams');
  expect(querySpecFile).not.toContain('export function parseInsertUsersRow');
  expect(querySpecFile).not.toContain('ScalarKind');
  expect(querySpecFile).not.toContain('parseBySpecs');

  const generatedRowMapperFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'queries', 'insert-users', 'generated', 'row-mapper.ts'),
    'utf8'
  );
  expect(generatedRowMapperFile).toContain('@generated by rawsql-ts ztd-cli');
  expect(generatedRowMapperFile).toContain('machine-owned');
  expect(generatedRowMapperFile).toContain('source-boundary-sha256:');
  expect(generatedRowMapperFile).toContain('source-sql-sha256:');
  expect(generatedRowMapperFile).toContain("import type { InsertUsersQueryResult, InsertUsersRow } from '../boundary.js';");
  expect(generatedRowMapperFile).not.toContain('rowMapperFallbackReason');
  expect(generatedRowMapperFile).toContain('export function mapInsertUsersRowToResult(row: InsertUsersRow): InsertUsersQueryResult');
  expect(generatedRowMapperFile).toContain('"id": row["id"],');
  await expect(
    runFeatureGeneratedMapperCheckCommand({
      feature: 'users-insert',
      query: 'insert-users',
      rootDir: workspace
    })
  ).resolves.toMatchObject({ ok: true });

  const sqlFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'queries', 'insert-users', 'insert-users.sql'),
    'utf8'
  );
  expect(sqlFile).toContain('insert into "public"."users" (');
  expect(sqlFile).toContain(':email');
  expect(sqlFile).toContain('now()');
  expect(sqlFile).not.toContain(':id');
  expect(sqlFile).not.toContain(':created_at');
  expect(sqlFile).toContain('returning "id";');

  expect(existsSync(path.join(workspace, 'src', 'features', 'users-insert', 'adapter-cli.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'features', 'users-insert', 'adapter-api.ts'))).toBe(false);
  expect(existsSync(path.join(workspace, 'src', 'features', 'users-insert', 'adapter-lambda.ts'))).toBe(false);

  const featureQueryExecutorFile = readFileSync(
    path.join(workspace, 'src', 'features', '_shared', 'featureQueryExecutor.ts'),
    'utf8'
  );
  expect(featureQueryExecutorFile).toContain('export interface FeatureQueryExecutor {');
  expect(featureQueryExecutorFile).toContain('Inject your DB execution implementation at this seam');

  const readmeFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'README.md'),
    'utf8'
  );
  expect(readmeFile).toContain('## RFBA review responsibilities');
  expect(readmeFile).toContain('RFBA splits files by review responsibility');
  expect(readmeFile).toContain('`boundary.ts` is the default feature-boundary public surface and should read as `input -> workflow -> output`.');
  expect(readmeFile).toContain('`input.ts` owns raw request parsing, normalization, and feature-level input rejection.');
  expect(readmeFile).toContain('`workflow.ts` owns the feature use-case flow and query orchestration.');
  expect(readmeFile).toContain('Feature-boundary and workflow tests should mock query ports rather than classify child queries by SQL text');
  expect(readmeFile).toContain('Query-boundary tests own SQL behavior through ZTD or another SQL-specific lane.');
  expect(readmeFile).toContain('Integration tests are opt-in and should be named as integration tests when they intentionally cross multiple live boundaries.');
  expect(readmeFile).toContain('Use `src/libraries/` only for driver-neutral code reusable enough to stand as an external package');
  expect(readmeFile).toContain('uses `zod` schemas for request DTOs');
  expect(readmeFile).toContain('Feature-local `boundary.ts` exports `execute`');
  expect(readmeFile).toContain('queries/insert-users/boundary.ts');
  expect(readmeFile).toContain('queries/insert-users/` is the query unit');
  expect(readmeFile).toContain('## CLI-owned generated files');
  expect(readmeFile).toContain('queries/insert-users/generated/row-mapper.ts');
  expect(readmeFile).toContain('ztd feature generated-mapper generate --feature users-insert --query insert-users');
  expect(readmeFile).toContain('ztd feature generated-mapper check --feature users-insert');
  expect(readmeFile).toContain('## Created by `feature tests scaffold` after SQL and DTO edits');
  expect(readmeFile).toContain('queries/insert-users/tests/boundary-ztd-types.ts');
  expect(readmeFile).toContain('insert-users/tests/generated/TEST_PLAN.md');
  expect(readmeFile).toContain('insert-users/tests/generated/analysis.json');
  expect(readmeFile).toContain('## Human/AI-owned persistent files');
  expect(readmeFile).not.toContain('## AI-created files');
  expect(readmeFile).toContain('Generated / identity / sequence-backed columns excluded at scaffold time: `id`.');
  expect(readmeFile).toContain('Initial insert query columns: `email`, `created_at`.');
  expect(readmeFile).toContain('Caller-supplied request/query params: `email`.');
  expect(readmeFile).toContain('DDL-backed default expressions written directly into SQL: `created_at`.');
  expect(readmeFile).toContain('When DDL declares a column default, the scaffold writes that default expression into SQL explicitly');
  expect(readmeFile).toContain('featureQueryExecutor.ts` is the shared runtime contract for DB execution injection');
  expect(readmeFile).toContain('Catalog runtime primitives from `@rawsql-ts/sql-contract`');
  expect(readmeFile).toContain('Keep this baseline as one workflow and one primary query by default');
});

test('runFeatureScaffoldCommand emits camelCase feature DTOs while keeping query params DB-shaped', async () => {
  const workspace = createTempDir('feature-scaffold-camel-dto');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'account_events.sql'),
    [
      'create table public.account_events (',
      '  id serial8 primary key,',
      '  account_id integer not null,',
      '  display_name text,',
      '  event_payload jsonb not null,',
      '  created_at timestamptz not null default now()',
      ');'
    ].join('\n'),
    'utf8'
  );

  await runFeatureScaffoldCommand({
    table: 'account_events',
    action: 'insert',
    rootDir: workspace
  });

  const inputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'account-events-insert', 'input.ts'),
    'utf8'
  );
  expect(inputFile).toContain('accountId: z.number().finite()');
  expect(inputFile).toContain('displayName: z.string().nullable()');
  expect(inputFile).toContain('eventPayload: z.record(z.string(), z.unknown())');
  expect(inputFile).not.toContain('account_id: z.number().finite()');
  expect(inputFile).not.toContain('display_name: z.string().nullable()');

  const workflowFile = readFileSync(
    path.join(workspace, 'src', 'features', 'account-events-insert', 'workflow.ts'),
    'utf8'
  );
  expect(workflowFile).toContain('account_id: request.accountId,');
  expect(workflowFile).toContain('display_name: request.displayName,');
  expect(workflowFile).toContain('event_payload: request.eventPayload,');

  const outputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'account-events-insert', 'output.ts'),
    'utf8'
  );
  expect(outputFile).toContain('id: result.id,');

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'account-events-insert', 'queries', 'insert-account-events', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).toContain('account_id: z.number().finite()');
  expect(querySpecFile).toContain("display_name: z.string().min(1, 'display_name must not be empty.').nullable()");
  expect(querySpecFile).toContain('event_payload: z.record(z.string(), z.unknown())');
  expect(querySpecFile).not.toContain('accountId: z.number().finite()');
  expect(querySpecFile).not.toContain('displayName: z.string().nullable()');

  const sqlFile = readFileSync(
    path.join(workspace, 'src', 'features', 'account-events-insert', 'queries', 'insert-account-events', 'insert-account-events.sql'),
    'utf8'
  );
  expect(sqlFile).toContain(':account_id');
  expect(sqlFile).toContain(':display_name');
  expect(sqlFile).toContain(':event_payload');
  expect(sqlFile).not.toContain(':accountId');
});

test('runFeatureScaffoldCommand uses stable shared imports when the workspace supports #features', async () => {
  const workspace = createTempDir('feature-scaffold-stable-imports');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  seedStableFeatureAliases(workspace);
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id integer generated always as identity primary key,',
      '  email text not null,',
      '  created_at timestamptz not null default now()',
      ');',
      ''
    ].join('\n'),
    'utf8'
  );

  await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    rootDir: workspace
  });

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'queries', 'insert-users', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).toContain("import type { FeatureQueryExecutor } from '#features/_shared/featureQueryExecutor.js';");
  expect(querySpecFile).toContain("import { loadSqlResource } from '#features/_shared/loadSqlResource.js';");
});

test('runFeatureScaffoldCommand falls back to relative imports when #features alias support is partial', async () => {
  const workspace = createTempDir('feature-scaffold-partial-import-alias');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(workspace, 'package.json'),
    `${JSON.stringify({
      name: 'feature-scaffold-test',
      private: true,
      type: 'module',
      imports: {
        '#features/*.js': {
          types: './src/features/*.ts',
          default: './dist/features/*.js'
        }
      }
    }, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    rootDir: workspace
  });

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'queries', 'insert-users', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).toContain("import type { FeatureQueryExecutor } from '../../../_shared/featureQueryExecutor.js';");
  expect(querySpecFile).toContain("import { loadSqlResource } from '../../../_shared/loadSqlResource.js';");
});

test('runFeatureScaffoldCommand uses default values when every insert column is DB-generated', async () => {
  const workspace = createTempDir('feature-scaffold-default-values');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key',
      ');'
    ].join('\n'),
    'utf8'
  );

  await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    rootDir: workspace
  });

  const sqlFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'queries', 'insert-users', 'insert-users.sql'),
    'utf8'
  );
  expect(sqlFile).toContain('insert into "public"."users"');
  expect(sqlFile).toContain('default values');

  const inputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'input.ts'),
    'utf8'
  );
  expect(inputFile).toContain('const RequestSchema = z.object({\n}).strict();');

  const workflowFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'workflow.ts'),
    'utf8'
  );
  expect(workflowFile).toContain('return {} as InsertUsersQueryParams;');

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'queries', 'insert-users', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).toContain('const QueryParamsSchema = z.object({\n}).strict();');
});

test('runFeatureScaffoldCommand renders primitive defaults directly into insert SQL', async () => {
  const workspace = createTempDir('feature-scaffold-primitive-defaults');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'flags.sql'),
    [
      'create table public.flags (',
      '  id serial primary key,',
      '  enabled boolean not null default false,',
      '  priority integer not null default 0,',
      '  name text not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  await runFeatureScaffoldCommand({
    table: 'flags',
    action: 'insert',
    rootDir: workspace
  });

  const sqlFile = readFileSync(
    path.join(workspace, 'src', 'features', 'flags-insert', 'queries', 'insert-flags', 'insert-flags.sql'),
    'utf8'
  );
  expect(sqlFile).toContain('false');
  expect(sqlFile).toContain('0');
  expect(sqlFile).toContain(':name');
});

test('runFeatureScaffoldCommand writes the update baseline with pk predicate and explicit set list', async () => {
  const workspace = createTempDir('feature-scaffold-update-write');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null,',
      '  display_name text,',
      '  created_at timestamptz not null default now()',
      ');'
    ].join('\n'),
    'utf8'
  );

  const result = await runFeatureScaffoldCommand({
    table: 'users',
    action: 'update',
    rootDir: workspace
  });

  expect(result.featureName).toBe('users-update');
  const inputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-update', 'input.ts'),
    'utf8'
  );
  expect(inputFile).toContain('export type UsersUpdateRequest');
  expect(inputFile).toContain('id: z.number().finite()');
  expect(inputFile).toContain('email: z.string()');
  expect(inputFile).toContain('displayName: z.string().nullable()');
  expect(inputFile).toContain('createdAt: z.string()');

  const workflowFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-update', 'workflow.ts'),
    'utf8'
  );
  expect(workflowFile).toContain('display_name: request.displayName,');
  expect(workflowFile).toContain('created_at: request.createdAt,');

  const outputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-update', 'output.ts'),
    'utf8'
  );
  expect(outputFile).toContain('export type UsersUpdateResponse = {');

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-update', 'queries', 'update-users', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).toContain('export type UpdateUsersQueryParams');
  expect(querySpecFile).toContain('loadSingleRow');
  expect(querySpecFile).not.toContain('queryExactlyOneRow');

  const sqlFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-update', 'queries', 'update-users', 'update-users.sql'),
    'utf8'
  );
  expect(sqlFile).toContain('update "public"."users"');
  expect(sqlFile).toContain('"email" = :email');
  expect(sqlFile).toContain('"display_name" = :display_name');
  expect(sqlFile).toContain('"created_at" = :created_at');
  expect(sqlFile).toContain('where');
  expect(sqlFile).toContain('"id" = :id');
  expect(sqlFile).toContain('returning "id";');
  expect(sqlFile).not.toContain('"id" = :id,\n');
  expect(sqlFile).not.toContain('where\n  "email" = :email');
  expect(sqlFile).not.toContain('where\n  "display_name" = :display_name');
  expect(sqlFile).not.toContain('where\n  "created_at" = :created_at');

  const updateReadmeFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-update', 'README.md'),
    'utf8'
  );
  expect(updateReadmeFile).toContain('mechanical, not a mutable-policy guarantee');
  expect(updateReadmeFile).toContain('`created_at`, `updated_at`, and similar fields are representative follow-up candidates');
  expect(updateReadmeFile).toContain('Generated / identity handling remains explicit in this write scaffold');
  expect(updateReadmeFile).toContain('Write baselines do not infer additional default-expression or policy behavior');
});

test('runFeatureScaffoldCommand writes the delete baseline with key-only predicate', async () => {
  const workspace = createTempDir('feature-scaffold-delete-write');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null',
      ');'
    ].join('\n'),
    'utf8'
  );

  const result = await runFeatureScaffoldCommand({
    table: 'users',
    action: 'delete',
    rootDir: workspace
  });

  expect(result.featureName).toBe('users-delete');
  const inputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-delete', 'input.ts'),
    'utf8'
  );
  expect(inputFile).toContain('export type UsersDeleteRequest');
  expect(inputFile).toContain('id: z.number().finite()');
  expect(inputFile).not.toContain('email:');

  const sqlFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-delete', 'queries', 'delete-users', 'delete-users.sql'),
    'utf8'
  );
  expect(sqlFile).toContain('delete from "public"."users"');
  expect(sqlFile).toContain('"id" = :id');
  expect(sqlFile).toContain('returning "id";');
  expect(sqlFile).not.toContain('"email" = :email');

  const deleteReadmeFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-delete', 'README.md'),
    'utf8'
  );
  expect(deleteReadmeFile).toContain('does not assume string normalization');
  expect(deleteReadmeFile).not.toContain('trim()` plus empty-string rejection examples for string inputs');
  expect(deleteReadmeFile).toContain('Generated / identity handling remains explicit in this write scaffold');
  expect(deleteReadmeFile).toContain('Write baselines do not infer additional default-expression or policy behavior');
});

test('runFeatureScaffoldCommand writes the get-by-id baseline with zero-or-one contract', async () => {
  const workspace = createTempDir('feature-scaffold-get-by-id-write');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial8 primary key,',
      '  email text not null,',
      '  display_name text',
      ');'
    ].join('\n'),
    'utf8'
  );

  const result = await runFeatureScaffoldCommand({
    table: 'users',
    action: 'get-by-id',
    rootDir: workspace
  });

  expect(result.featureName).toBe('users-get-by-id');
  const inputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-get-by-id', 'input.ts'),
    'utf8'
  );
  expect(inputFile).toContain('const RequestSchema = z.object({');
  expect(inputFile).toContain('}).strict();');
  expect(inputFile).toContain('function parseRequest');
  expect(inputFile).toContain('function normalizeRequest');
  expect(inputFile).toContain('function rejectRequest');
  expect(inputFile).toContain('id: z.string()');
  expect(inputFile).not.toContain('QueryParamsSchema');

  const workflowFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-get-by-id', 'workflow.ts'),
    'utf8'
  );
  expect(workflowFile).toContain('function toQueryParams');
  expect(workflowFile).toContain('Maps the feature request into query params for the query spec.');

  const outputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-get-by-id', 'output.ts'),
    'utf8'
  );
  expect(outputFile).toContain('export type UsersGetByIdResponse = {');
  expect(outputFile).toContain('} | null;');
  expect(outputFile).toContain('if (result === null)');

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-get-by-id', 'queries', 'get-by-id', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).not.toContain('queryZeroOrOneRow');
  expect(querySpecFile).toContain('}).strict();');
  expect(querySpecFile).toContain('const RowSchema = z.object({');
  expect(querySpecFile).toContain('const QueryResultSchema = RowSchema.nullable();');
  expect(querySpecFile).toContain("import { mapGetByIdRowToResult } from './generated/row-mapper.js';");
  expect(querySpecFile).toContain('function parseQueryParams');
  expect(querySpecFile).toContain('function parseRow');
  expect(querySpecFile).not.toContain('function mapRowToResult');
  expect(querySpecFile).toContain('loadOptionalRow');
  expect(querySpecFile).toContain('executor.query<Record<string, unknown>>(sql, params)');
  expect(querySpecFile).toContain('return mapGetByIdRowToResult(row);');

  const generatedRowMapperFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-get-by-id', 'queries', 'get-by-id', 'generated', 'row-mapper.ts'),
    'utf8'
  );
  expect(generatedRowMapperFile).toContain('export function mapGetByIdRowToResult(row: GetByIdRow | undefined): GetByIdQueryResult');
  expect(generatedRowMapperFile).toContain('return null;');
  expect(generatedRowMapperFile).toContain('"display_name": row["display_name"],');

  const sqlFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-get-by-id', 'queries', 'get-by-id', 'get-by-id.sql'),
    'utf8'
  );
  expect(sqlFile).toContain('select');
  expect(sqlFile).toContain('from "public"."users"');
  expect(sqlFile).toContain('"id" = :id');

  const readmeFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-get-by-id', 'README.md'),
    'utf8'
  );
  expect(readmeFile).toContain('The baseline allows not found instead of treating it as an exception.');
  expect(readmeFile).toContain('does not assume that every ID is a 32-bit integer');
  expect(readmeFile).toContain('rejects unsupported request fields instead of silently ignoring them');
  expect(readmeFile).toContain('tightened to a strict one-row contract');
});

test('runFeatureScaffoldCommand writes the list baseline with catalog paging and items response', async () => {
  const workspace = createTempDir('feature-scaffold-list-write');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial8 primary key,',
      '  email text not null,',
      '  is_active boolean not null default true',
      ');'
    ].join('\n'),
    'utf8'
  );

  const result = await runFeatureScaffoldCommand({
    table: 'users',
    action: 'list',
    rootDir: workspace
  });

  expect(result.featureName).toBe('users-list');
  const inputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-list', 'input.ts'),
    'utf8'
  );
  expect(inputFile).toContain('const RequestSchema = z.object({\n}).strict();');
  expect(inputFile).toContain('function parseRequest');
  expect(inputFile).toContain('function normalizeRequest');
  expect(inputFile).toContain('function rejectRequest');

  const workflowFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-list', 'workflow.ts'),
    'utf8'
  );
  expect(workflowFile).toContain('Maps the feature request into query params for the query spec.');
  expect(workflowFile).toContain('function toQueryParams');
  expect(workflowFile).toContain('return {} as ListQueryParams;');

  const outputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-list', 'output.ts'),
    'utf8'
  );
  expect(outputFile).toContain('export type UsersListResponse = {');
  expect(outputFile).toContain('items: Array<{');
  expect(outputFile).toContain('id: string;');
  expect(outputFile).toContain('items: result.items.map((item) => ({');

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-list', 'queries', 'list', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).toContain("import { createCatalogExecutor, type QuerySpec } from '@rawsql-ts/sql-contract';");
  expect(querySpecFile).toContain('const QueryParamsSchema = z.object({\n}).strict();');
  expect(querySpecFile).toContain('const RowSchema = z.object({');
  expect(querySpecFile).toContain('const DEFAULT_PAGE_SIZE = 50;');
  expect(querySpecFile).toContain('allowNamedParamsWithoutBinder: true');
  expect(querySpecFile).toContain('items: z.array(RowSchema)');
  expect(querySpecFile).toContain('}).strict();');
  expect(querySpecFile).toContain('limit: DEFAULT_PAGE_SIZE');
  expect(querySpecFile).toContain('function parseQueryParams');
  expect(querySpecFile).toContain('function parseRow');
  expect(querySpecFile).toContain('function toQueryParams');
  expect(querySpecFile).toContain("import { mapListRowsToResult } from './generated/row-mapper.js';");
  expect(querySpecFile).not.toContain('function mapRowsToResult');
  expect(querySpecFile).toContain('return mapListRowsToResult(rows);');

  const generatedRowMapperFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-list', 'queries', 'list', 'generated', 'row-mapper.ts'),
    'utf8'
  );
  expect(generatedRowMapperFile).toContain('function mapListRow(row: ListRow): ListQueryResult');
  expect(generatedRowMapperFile).toContain('export function mapListRowsToResult(rows: ListRow[]): ListQueryResult');
  expect(generatedRowMapperFile).toContain('"is_active": row["is_active"],');

  const sqlFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-list', 'queries', 'list', 'list.sql'),
    'utf8'
  );
  expect(sqlFile).toContain('order by');
  expect(sqlFile).toContain('"id" asc');
  expect(sqlFile).toContain('limit :limit;');

  const readmeFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-list', 'README.md'),
    'utf8'
  );
  expect(readmeFile).toContain('filter fields');
  expect(readmeFile).toContain('paging enabled by default');
  expect(readmeFile).toContain('`DEFAULT_PAGE_SIZE` is set to `50`');
  expect(readmeFile).toContain('stable primary-key ordering');
  expect(readmeFile).toContain('does not assume that every ID is a 32-bit integer');
  expect(readmeFile).toContain('rejects unsupported request fields instead of silently ignoring them');
  expect(readmeFile).toContain('The baseline response is `{ items: [...] }`');
});

test('runFeatureScaffoldCommand keeps numeric and decimal read contracts string-based', async () => {
  const workspace = createTempDir('feature-scaffold-list-numeric-write');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'products.sql'),
    [
      'create table public.products (',
      '  id serial8 primary key,',
      '  price decimal not null,',
      '  score numeric',
      ');'
    ].join('\n'),
    'utf8'
  );

  const result = await runFeatureScaffoldCommand({
    table: 'products',
    action: 'list',
    rootDir: workspace
  });

  expect(result.featureName).toBe('products-list');
  const outputFile = readFileSync(
    path.join(workspace, 'src', 'features', 'products-list', 'output.ts'),
    'utf8'
  );
  expect(outputFile).toContain('price: string;');
  expect(outputFile).toContain('score: string | null;');
  expect(outputFile).not.toContain('price: number;');
  expect(outputFile).not.toContain('score: number | null;');

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'products-list', 'queries', 'list', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).toContain('price: z.string()');
  expect(querySpecFile).toContain('score: z.string().nullable()');
  expect(querySpecFile).not.toContain('price: z.number().finite()');
  expect(querySpecFile).not.toContain('score: z.number().finite()');
});

test('runFeatureScaffoldCommand preserves existing feature files unless force is set', async () => {
  const workspace = createTempDir('feature-scaffold-collision');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const featureDir = path.join(workspace, 'src', 'features', 'users-insert');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(path.join(featureDir, 'queries', 'insert-users'), { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null',
      ');'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(path.join(featureDir, 'boundary.ts'), '// existing file\n', 'utf8');
  writeFileSync(path.join(featureDir, 'queries', 'insert-users', 'boundary.ts'), '// existing query boundary\n', 'utf8');
  writeFileSync(path.join(featureDir, 'queries', 'insert-users', 'insert-users.sql'), '-- existing sql\n', 'utf8');

  await expect(
    runFeatureScaffoldCommand({
      table: 'users',
      action: 'insert',
      rootDir: workspace
    })
  ).rejects.toThrow(/overwrite existing files/i);
  expect(readFileSync(path.join(featureDir, 'queries', 'insert-users', 'boundary.ts'), 'utf8')).toBe('// existing query boundary\n');
  expect(readFileSync(path.join(featureDir, 'queries', 'insert-users', 'insert-users.sql'), 'utf8')).toBe('-- existing sql\n');
});

test('runFeatureScaffoldCommand overwrites scaffold-owned feature files with --force', async () => {
  const workspace = createTempDir('feature-scaffold-force');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const featureDir = path.join(workspace, 'src', 'features', 'users-insert');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(path.join(featureDir, 'queries', 'insert-users'), { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null',
      ');'
    ].join('\n'),
    'utf8'
  );
  writeFileSync(path.join(featureDir, 'boundary.ts'), '// existing boundary\n', 'utf8');
  writeFileSync(path.join(featureDir, 'queries', 'insert-users', 'boundary.ts'), '// existing query boundary\n', 'utf8');
  writeFileSync(path.join(featureDir, 'queries', 'insert-users', 'insert-users.sql'), '-- existing sql\n', 'utf8');
  writeFileSync(path.join(featureDir, 'README.md'), '# existing readme\n', 'utf8');
  mkdirSync(path.join(featureDir, 'queries', 'insert-users', 'generated'), { recursive: true });
  writeFileSync(
    path.join(featureDir, 'queries', 'insert-users', 'generated', 'row-mapper.ts'),
    '// stale generated mapper\n',
    'utf8'
  );

  const result = await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    force: true,
    rootDir: workspace
  });

  expect(result.dryRun).toBe(false);
  expect(readFileSync(path.join(featureDir, 'boundary.ts'), 'utf8')).toContain(
    'export async function execute('
  );
  expect(readFileSync(path.join(featureDir, 'input.ts'), 'utf8')).toContain('export function parseRequest');
  expect(readFileSync(path.join(featureDir, 'workflow.ts'), 'utf8')).toContain('export async function execute(');
  expect(readFileSync(path.join(featureDir, 'output.ts'), 'utf8')).toContain('export function buildResult');
  expect(readFileSync(path.join(featureDir, 'queries', 'insert-users', 'boundary.ts'), 'utf8')).not.toContain('// existing query boundary');
  expect(readFileSync(path.join(featureDir, 'queries', 'insert-users', 'insert-users.sql'), 'utf8')).not.toContain('-- existing sql');
  expect(readFileSync(path.join(featureDir, 'queries', 'insert-users', 'generated', 'row-mapper.ts'), 'utf8')).toContain(
    'export function mapInsertUsersRowToResult(row: InsertUsersRow): InsertUsersQueryResult'
  );
});

test('generated mapper check fails on drift and reports the regeneration command', async () => {
  const workspace = createTempDir('feature-generated-mapper-check');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const generatedMapperFile = path.join(
    workspace,
    'src',
    'features',
    'users-insert',
    'queries',
    'insert-users',
    'generated',
    'row-mapper.ts'
  );
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null',
      ');'
    ].join('\n'),
    'utf8'
  );
  await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    rootDir: workspace
  });
  writeFileSync(generatedMapperFile, '// stale generated mapper\n', 'utf8');

  await expect(
    runFeatureGeneratedMapperCheckCommand({
      feature: 'users-insert',
      query: 'insert-users',
      rootDir: workspace
    })
  ).rejects.toThrow(/ztd feature generated-mapper generate --feature users-insert --query insert-users/);
});

test('generated mapper check fails when query SQL changes without regenerating the mapper', async () => {
  const workspace = createTempDir('feature-generated-mapper-sql-drift');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const querySqlFile = path.join(
    workspace,
    'src',
    'features',
    'users-insert',
    'queries',
    'insert-users',
    'insert-users.sql'
  );
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null',
      ');'
    ].join('\n'),
    'utf8'
  );
  await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    rootDir: workspace
  });
  writeFileSync(querySqlFile, `${readFileSync(querySqlFile, 'utf8')}\n-- reviewer edit\n`, 'utf8');

  await expect(
    runFeatureGeneratedMapperCheckCommand({
      feature: 'users-insert',
      query: 'insert-users',
      rootDir: workspace
    })
  ).rejects.toThrow(/ztd feature generated-mapper generate --feature users-insert --query insert-users/);
});

test('generated mapper check fails when the query boundary contract changes without regenerating the mapper', async () => {
  const workspace = createTempDir('feature-generated-mapper-boundary-drift');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const queryBoundaryFile = path.join(
    workspace,
    'src',
    'features',
    'users-insert',
    'queries',
    'insert-users',
    'boundary.ts'
  );
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null',
      ');'
    ].join('\n'),
    'utf8'
  );
  await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    rootDir: workspace
  });
  writeFileSync(queryBoundaryFile, `${readFileSync(queryBoundaryFile, 'utf8')}\n// reviewer contract edit\n`, 'utf8');

  await expect(
    runFeatureGeneratedMapperCheckCommand({
      feature: 'users-insert',
      query: 'insert-users',
      rootDir: workspace
    })
  ).rejects.toThrow(/ztd feature generated-mapper generate --feature users-insert --query insert-users/);
});

test('generated mapper generate force-syncs machine-owned files from the boundary contract', async () => {
  const workspace = createTempDir('feature-generated-mapper-generate');
  const ddlDir = path.join(workspace, 'db', 'ddl');
  const generatedMapperFile = path.join(
    workspace,
    'src',
    'features',
    'users-insert',
    'queries',
    'insert-users',
    'generated',
    'row-mapper.ts'
  );
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'users.sql'),
    [
      'create table public.users (',
      '  id serial primary key,',
      '  email text not null',
      ');'
    ].join('\n'),
    'utf8'
  );
  await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    rootDir: workspace
  });
  writeFileSync(generatedMapperFile, '// stale generated mapper\n', 'utf8');

  const result = await runFeatureGeneratedMapperGenerateCommand({
    feature: 'users-insert',
    query: 'insert-users',
    rootDir: workspace
  });

  expect(result.outputs).toEqual([
    expect.objectContaining({
      path: 'src/features/users-insert/queries/insert-users/generated/row-mapper.ts',
      written: true,
      changed: true
    })
  ]);
  expect(readFileSync(generatedMapperFile, 'utf8')).toContain(
    'export function mapInsertUsersRowToResult(row: InsertUsersRow): InsertUsersQueryResult'
  );
  await expect(
    runFeatureGeneratedMapperCheckCommand({
      feature: 'users-insert',
      query: 'insert-users',
      rootDir: workspace
    })
  ).resolves.toMatchObject({ ok: true });
});
