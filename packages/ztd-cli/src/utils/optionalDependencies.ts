const moduleCache = new Map<string, Promise<unknown>>();

async function loadOptionalModule<T>(
  specifier: string,
  description: string,
  installHint: string
): Promise<T> {
  if (moduleCache.has(specifier)) {
    return moduleCache.get(specifier) as Promise<T>;
  }

  const loader = import(specifier)
    .then((value) => value as T)
    .catch((error) => {
      moduleCache.delete(specifier);
      const installNote = installHint ? ` Install it via \`${installHint}\`.` : '';
      const original = error instanceof Error ? ` (${error.message})` : '';
      throw new Error(`${description}${installNote}${original}`);
    });

  moduleCache.set(specifier, loader);
  return loader;
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

export async function ensureTestkitCoreModule(): Promise<TestkitCoreModule> {
  return loadOptionalModule(
    '@rawsql-ts/testkit-core',
    'This command requires @rawsql-ts/testkit-core so fixtures and schema metadata are available.',
    'pnpm add -D @rawsql-ts/testkit-core'
  );
}

export async function ensureAdapterNodePgModule(): Promise<AdapterNodePgModule> {
  return loadOptionalModule(
    '@rawsql-ts/adapter-node-pg',
    'A database adapter (for example @rawsql-ts/adapter-node-pg) is required to execute the rewritten SQL.',
    'pnpm add -D @rawsql-ts/adapter-node-pg'
  );
}

export async function ensurePgModule(): Promise<PgModule> {
  return loadOptionalModule(
    'pg',
    'The SQL lint command needs a PostgreSQL driver such as pg.',
    'pnpm add -D pg'
  );
}

export async function ensurePostgresContainerModule(): Promise<PostgresContainerModule> {
  return loadOptionalModule(
    '@testcontainers/postgresql',
    'ztd lint wants to spin up a disposable Postgres container via @testcontainers/postgresql.',
    'pnpm add -D @testcontainers/postgresql'
  );
}
