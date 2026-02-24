import path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const moduleCache = new Map<string, Promise<unknown>>();
const currentDirPath = resolveCurrentDirPath();
const repositoryRoot = findRepositoryRoot(currentDirPath);

async function loadOptionalModule<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  description: string,
  installHint: string
): Promise<T> {
  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey) as Promise<T>;
  }

  const moduleLoader = loader()
    .catch((error) => {
      moduleCache.delete(cacheKey);
      const installNote = installHint ? ` Install it via \`${installHint}\`.` : '';
      const original = error instanceof Error ? ` (${error.message})` : '';
      throw new Error(`${description}${installNote}${original}`);
    });

  moduleCache.set(cacheKey, moduleLoader);
  return moduleLoader;
}

export type TestkitCoreModule = typeof import('@rawsql-ts/testkit-core');

export interface PgTestkitClientLike {
  query(statement: string): Promise<unknown>;
  close(): Promise<unknown>;
}

export interface AdapterNodePgModule {
  createPgTestkitClient(options: Record<string, unknown>): PgTestkitClientLike;
}

export interface PgClientLike {
  connect(): Promise<unknown>;
  end(): Promise<unknown>;
}

export interface PgModule {
  Client: new (options: { connectionString: string }) => PgClientLike;
}

export interface PostgresContainerLike {
  getConnectionUri(): string;
  stop(): Promise<unknown>;
}

export interface PostgresContainerBuilderLike {
  withDatabase(database: string): PostgresContainerBuilderLike;
  withUsername(username: string): PostgresContainerBuilderLike;
  withPassword(password: string): PostgresContainerBuilderLike;
  start(): Promise<PostgresContainerLike>;
}

export interface PostgresContainerModule {
  PostgreSqlContainer: new (image?: string) => PostgresContainerBuilderLike;
}

export function clearOptionalDependencyCache(): void {
  moduleCache.clear();
}

function resolveCurrentDirPath(): string {
  // Evaluate import.meta.url at runtime so this module can still be compiled in CJS-oriented ts-node flows.
  const importMetaUrl = tryGetImportMetaUrl();
  if (importMetaUrl) {
    return path.dirname(fileURLToPath(importMetaUrl));
  }
  if (typeof __dirname === 'string') {
    return __dirname;
  }
  throw new Error('Failed to resolve current module directory for optional dependency loading.');
}

function tryGetImportMetaUrl(): string | undefined {
  try {
    return Function('return import.meta.url')() as string;
  } catch {
    return undefined;
  }
}

function findRepositoryRoot(startDir: string): string {
  let cursor = startDir;
  while (true) {
    // Treat the monorepo root as the first directory containing both workspace marker files.
    const hasWorkspaceFile = existsSync(path.join(cursor, 'pnpm-workspace.yaml'));
    const hasPackageJson = existsSync(path.join(cursor, 'package.json'));
    if (hasWorkspaceFile && hasPackageJson) {
      return cursor;
    }

    const parentDir = path.dirname(cursor);
    if (parentDir === cursor) {
      throw new Error(
        'Failed to locate repository root while resolving optional dependencies.'
      );
    }
    cursor = parentDir;
  }
}

function requireFromWorkspace<T>(specifier: string): T {
  const require = createRequire(path.join(repositoryRoot, 'package.json'));
  return require(specifier) as T;
}

async function loadAdapterNodePgModule(): Promise<AdapterNodePgModule> {
  try {
    return requireFromWorkspace<AdapterNodePgModule>('@rawsql-ts/adapter-node-pg');
  } catch (error) {
    // Workspace tests can run before adapter build output exists, so use source entrypoint.
    const workspaceAdapterSrc = path.join(
      repositoryRoot,
      'packages/adapters/adapter-node-pg/src/index.ts'
    );
    try {
      return (await import(pathToFileURL(workspaceAdapterSrc).href)) as AdapterNodePgModule;
    } catch {
      throw error;
    }
  }
}

export async function ensureTestkitCoreModule(): Promise<TestkitCoreModule> {
  return loadOptionalModule(
    '@rawsql-ts/testkit-core',
    () => import('@rawsql-ts/testkit-core'),
    'This command requires @rawsql-ts/testkit-core so fixtures and schema metadata are available.',
    'pnpm add -D @rawsql-ts/testkit-core'
  );
}

export async function ensureAdapterNodePgModule(): Promise<AdapterNodePgModule> {
  return loadOptionalModule(
    '@rawsql-ts/adapter-node-pg',
    loadAdapterNodePgModule,
    'A database adapter (for example @rawsql-ts/adapter-node-pg) is required to execute the rewritten SQL.',
    'pnpm add -D @rawsql-ts/adapter-node-pg'
  );
}

export async function ensurePgModule(): Promise<PgModule> {
  return loadOptionalModule(
    'pg',
    () => import('pg'),
    'The SQL lint command needs a PostgreSQL driver such as pg.',
    'pnpm add -D pg'
  );
}

export async function ensurePostgresContainerModule(): Promise<PostgresContainerModule> {
  return loadOptionalModule(
    '@testcontainers/postgresql',
    () => import('@testcontainers/postgresql'),
    'ztd lint wants to spin up a disposable Postgres container via @testcontainers/postgresql.',
    'pnpm add -D @testcontainers/postgresql'
  );
}
