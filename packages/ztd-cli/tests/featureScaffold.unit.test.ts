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

test('normalizeFeatureName enforces resource-action kebab-case', () => {
  expect(normalizeFeatureName('users-insert')).toBe('users-insert');
  expect(() => normalizeFeatureName('users')).toThrow(/resource-action/i);
  expect(() => normalizeFeatureName('3users-insert')).toThrow(/start with a letter/i);
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
    'src/features/users-insert/queries/insert-users',
    'src/features/users-insert/queries/insert-users/boundary.ts',
    'src/features/users-insert/queries/insert-users/insert-users.sql',
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
  expect(entrySpecFile).toContain("import { z } from 'zod';");
  expect(entrySpecFile).toContain("import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';");
  expect(entrySpecFile).toContain('const RequestSchema = z.object({');
  expect(entrySpecFile).toContain('}).strict();');
  expect(entrySpecFile).toContain('export type UsersInsertRequest = z.infer<typeof RequestSchema>;');
  expect(entrySpecFile).toContain('const ResponseSchema = z.object({');
  expect(entrySpecFile).toContain('export type UsersInsertResponse = z.infer<typeof ResponseSchema>;');
  expect(entrySpecFile).not.toContain('export type UsersInsertEntryExecutor');
  expect(entrySpecFile).not.toContain('QueryParamsSchema');
  expect(entrySpecFile).not.toContain('InsertUsersQueryExecutor');
  expect(entrySpecFile).toContain('/** Parses the raw feature request at the feature boundary. */');
  expect(entrySpecFile).toContain('function parseRequest');
  expect(entrySpecFile).toContain('/** Normalizes the parsed feature request for downstream feature logic. */');
  expect(entrySpecFile).toContain('function normalizeRequest');
  expect(entrySpecFile).toContain('email: request.email.trim()');
  expect(entrySpecFile).toContain("throw new Error('UsersInsertRequest.email must not be empty after trim().');");
  expect(entrySpecFile).not.toContain('UsersInsertRequest.id');
  expect(entrySpecFile).not.toContain('id: z.string()');
  expect(entrySpecFile).not.toContain('created_at: request.created_at.trim()');
  expect(entrySpecFile).not.toContain('UsersInsertRequest.created_at');
  expect(entrySpecFile).toContain('/** Rejects feature requests that violate feature-level rules. */');
  expect(entrySpecFile).toContain('function rejectRequest');
  expect(entrySpecFile).toContain('/** Maps the feature request into query params for the query spec. */');
  expect(entrySpecFile).toContain('function toQueryParams');
  expect(entrySpecFile).toContain('return {');
  expect(entrySpecFile).toContain('email: request.email,');
  expect(entrySpecFile).not.toContain('id: request.id,');
  expect(entrySpecFile).not.toContain('created_at: request.created_at,');
  expect(entrySpecFile).toContain('/** Maps the query result into the feature response contract. */');
  expect(entrySpecFile).toContain('function fromQueryResult');
  expect(entrySpecFile).toContain('/** Executes the feature boundary flow for this feature. */');
  expect(entrySpecFile).toContain('export async function executeUsersInsertEntrySpec');
  expect(entrySpecFile).toContain('executor: FeatureQueryExecutor,');
  expect(entrySpecFile).not.toContain('ScalarKind');
  expect(entrySpecFile).not.toContain('parseBySpecs');
  expect(entrySpecFile).not.toContain('expectObject');
  expect(entrySpecFile).not.toContain('matchesKind');

  const entrySpecTestFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'tests', 'users-insert.boundary.test.ts'),
    'utf8'
  );
  expect(entrySpecTestFile).toContain("import { expect, test } from 'vitest';");
  expect(entrySpecTestFile).toContain("import { executeUsersInsertEntrySpec } from '../boundary.js';");
  expect(entrySpecTestFile).toContain("import type { FeatureQueryExecutor } from '../../_shared/featureQueryExecutor.js';");
  expect(entrySpecTestFile).toContain('function createGuardedExecutor(): FeatureQueryExecutor');
  expect(entrySpecTestFile).toContain("test('rejects invalid feature input at the feature boundary for users-insert/insert-users', async () => {");
  expect(entrySpecTestFile).toContain('await expect(executeUsersInsertEntrySpec(createGuardedExecutor(), {})).rejects.toThrow();');
  expect(entrySpecTestFile).toContain("test.todo('cover normalization and response mapping for UsersInsert boundary');");

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'queries', 'insert-users', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).toContain("import { z } from 'zod';");
  expect(querySpecFile).toContain("import type { FeatureQueryExecutor } from '../../../_shared/featureQueryExecutor.js';");
  expect(querySpecFile).toContain("const insertUsersSqlResource = loadSqlResource(__dirname, 'insert-users.sql');");
  expect(querySpecFile).toContain('const QueryParamsSchema = z.object({');
  expect(querySpecFile).toContain("}).strict();");
  expect(querySpecFile).toContain("email: z.string().min(1, 'email must not be empty.')");
  expect(querySpecFile).not.toContain("id: z.string().min(1, 'id must not be empty.')");
  expect(querySpecFile).not.toContain('created_at: z.string().min(1');
  expect(querySpecFile).toContain('export type InsertUsersQueryParams = z.infer<typeof QueryParamsSchema>;');
  expect(querySpecFile).toContain('type InsertUsersRow = z.infer<typeof RowSchema>;');
  expect(querySpecFile).toContain('export type InsertUsersQueryResult = z.infer<typeof QueryResultSchema>;');
  expect(querySpecFile).toContain('/** Parses raw query params at the query boundary. */');
  expect(querySpecFile).toContain('function parseQueryParams');
  expect(querySpecFile).toContain('/** Parses a raw DB row at the query boundary. */');
  expect(querySpecFile).toContain('function parseRow');
  expect(querySpecFile).toContain('/** Maps a query row into the query result contract. */');
  expect(querySpecFile).toContain('function mapRowToResult');
  expect(querySpecFile).toContain('/** Executes the query boundary flow for this query spec. */');
  expect(querySpecFile).toContain('export async function executeInsertUsersQuerySpec');
  expect(querySpecFile).toContain('loadSingleRow');
  expect(querySpecFile).toContain('executor.query<Record<string, unknown>>(sql, params)');
  expect(querySpecFile).not.toContain('export interface InsertUsersQueryContract');
  expect(querySpecFile).not.toContain('export const insertUsersQueryContract');
  expect(querySpecFile).not.toContain('export function parseInsertUsersQueryParams');
  expect(querySpecFile).not.toContain('export function parseInsertUsersRow');
  expect(querySpecFile).not.toContain('ScalarKind');
  expect(querySpecFile).not.toContain('parseBySpecs');

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
  expect(readmeFile).toContain('`boundary.ts` is the feature boundary public surface');
  expect(readmeFile).toContain('uses `zod` schemas for request and response DTOs');
  expect(readmeFile).toContain('keeps its schema values and helper functions file-local');
  expect(readmeFile).toContain('depends on the shared executor contract directly');
  expect(readmeFile).toContain('queries/insert-users/boundary.ts');
  expect(readmeFile).toContain('## CLI-owned generated files');
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

  const entrySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-insert', 'boundary.ts'),
    'utf8'
  );
  expect(entrySpecFile).toContain('const RequestSchema = z.object({\n}).strict();');
  expect(entrySpecFile).toContain('return {} as InsertUsersQueryParams;');

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
  const entrySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-update', 'boundary.ts'),
    'utf8'
  );
  expect(entrySpecFile).toContain('export type UsersUpdateRequest');
  expect(entrySpecFile).toContain('id: z.number().finite()');
  expect(entrySpecFile).toContain('email: z.string()');
  expect(entrySpecFile).toContain('display_name: z.string().nullable()');
  expect(entrySpecFile).toContain('created_at: z.string()');
  expect(entrySpecFile).toContain('const ResponseSchema = z.object({');
  expect(entrySpecFile).toContain('}).strict();');

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
  const entrySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-delete', 'boundary.ts'),
    'utf8'
  );
  expect(entrySpecFile).toContain('export type UsersDeleteRequest');
  expect(entrySpecFile).toContain('id: z.number().finite()');
  expect(entrySpecFile).not.toContain('email:');

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
  const entrySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-get-by-id', 'boundary.ts'),
    'utf8'
  );
  expect(entrySpecFile).toContain('const RequestSchema = z.object({');
  expect(entrySpecFile).toContain('}).strict();');
  expect(entrySpecFile).toContain('const ResponseRowSchema = z.object({');
  expect(entrySpecFile).toContain('}).strict();');
  expect(entrySpecFile).toContain('const ResponseSchema = ResponseRowSchema.nullable();');
  expect(entrySpecFile).toContain('function toQueryParams');
  expect(entrySpecFile).toContain('Maps the feature request into query params for the query spec.');
  expect(entrySpecFile).toContain('function parseRequest');
  expect(entrySpecFile).toContain('function normalizeRequest');
  expect(entrySpecFile).toContain('function rejectRequest');
  expect(entrySpecFile).toContain('function fromQueryResult');
  expect(entrySpecFile).toContain('id: z.string()');
  expect(entrySpecFile).not.toContain('QueryParamsSchema');

  const querySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-get-by-id', 'queries', 'get-by-id', 'boundary.ts'),
    'utf8'
  );
  expect(querySpecFile).not.toContain('queryZeroOrOneRow');
  expect(querySpecFile).toContain('}).strict();');
  expect(querySpecFile).toContain('const RowSchema = z.object({');
  expect(querySpecFile).toContain('const QueryResultSchema = RowSchema.nullable();');
  expect(querySpecFile).toContain('function parseQueryParams');
  expect(querySpecFile).toContain('function parseRow');
  expect(querySpecFile).toContain('function mapRowToResult');
  expect(querySpecFile).toContain('loadOptionalRow');
  expect(querySpecFile).toContain('executor.query<Record<string, unknown>>(sql, params)');
  expect(querySpecFile).toContain('return null;');

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
  const entrySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'users-list', 'boundary.ts'),
    'utf8'
  );
  expect(entrySpecFile).toContain('const RequestSchema = z.object({\n}).strict();');
  expect(entrySpecFile).toContain('const ResponseSchema = z.object({');
  expect(entrySpecFile).toContain('items: z.array(ResponseItemSchema)');
  expect(entrySpecFile).toContain('}).strict();');
  expect(entrySpecFile).toContain('Maps the feature request into query params for the query spec.');
  expect(entrySpecFile).toContain('function parseRequest');
  expect(entrySpecFile).toContain('function normalizeRequest');
  expect(entrySpecFile).toContain('function rejectRequest');
  expect(entrySpecFile).toContain('function toQueryParams');
  expect(entrySpecFile).toContain('function fromQueryResult');
  expect(entrySpecFile).toContain('id: z.string()');
  expect(entrySpecFile).toContain('return {} as ListQueryParams;');

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
  expect(querySpecFile).toContain('function mapRowsToResult');

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
  const entrySpecFile = readFileSync(
    path.join(workspace, 'src', 'features', 'products-list', 'boundary.ts'),
    'utf8'
  );
  expect(entrySpecFile).toContain('price: z.string()');
  expect(entrySpecFile).toContain('score: z.string().nullable()');
  expect(entrySpecFile).not.toContain('price: z.number().finite()');
  expect(entrySpecFile).not.toContain('score: z.number().finite()');

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

  const result = await runFeatureScaffoldCommand({
    table: 'users',
    action: 'insert',
    force: true,
    rootDir: workspace
  });

  expect(result.dryRun).toBe(false);
  expect(readFileSync(path.join(featureDir, 'boundary.ts'), 'utf8')).toContain(
    'export async function executeUsersInsertEntrySpec'
  );
  expect(readFileSync(path.join(featureDir, 'queries', 'insert-users', 'boundary.ts'), 'utf8')).not.toContain('// existing query boundary');
  expect(readFileSync(path.join(featureDir, 'queries', 'insert-users', 'insert-users.sql'), 'utf8')).not.toContain('-- existing sql');
});
