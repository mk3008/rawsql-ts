import { Client, Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createPgTestkitClient } from '../src';
import type { PgFixture, PgQueryable, PgQueryInput } from '../src';
import type {
  QueryArrayConfig,
  QueryArrayResult,
  QueryConfig,
  QueryConfigValues,
  QueryResult,
  QueryResultRow,
  Submittable,
} from 'pg';
import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { UserRepository } from './prisma-app/UserRepository';

declare module 'vitest' {
  interface ProvidedContext {
    TEST_PG_URI: string;
  }
}

const userFixture: PgFixture = {
  tableName: 'users_prisma',
  columns: [
    { name: 'id', typeName: 'int', required: true, defaultValue: "nextval('users_prisma_id_seq'::regclass)" },
    { name: 'email', typeName: 'text', required: true },
    { name: 'active', typeName: 'bool', defaultValue: 'true' },
  ],
  rows: [
    { id: 1, email: 'alice@example.com', active: true },
    { id: 2, email: 'bob@example.com', active: false },
  ],
};

const prismaTmpDir = path.resolve(__dirname, '../tmp/prisma');
const prismaClientOutput = path.join(prismaTmpDir, 'client');
const prismaSchemaPath = path.resolve(__dirname, './prisma-app/schema.prisma');
const prismaConfigPath = path.resolve(__dirname, '../prisma.config.ts');

// Generate a Prisma Client into tmp so production artifacts remain untouched.
const ensurePrismaClient = (databaseUrl: string): void => {
  if (existsSync(path.join(prismaClientOutput, 'index.js'))) {
    return;
  }

  mkdirSync(prismaTmpDir, { recursive: true });

  execSync(
    `pnpm --filter @rawsql-ts/pg-testkit exec prisma generate --schema "${prismaSchemaPath}" --config "${prismaConfigPath}"`,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        NODE_PATH: path.resolve(__dirname, '..', 'node_modules'),
      },
      cwd: path.resolve(__dirname, '..'),
    }
  );
};

// Load the generated Prisma Client from tmp to keep it separate from published output.
const importPrismaClient = async (): Promise<{ PrismaClient: new (...args: unknown[]) => PrismaClientType }> => {
  // @ts-expect-error generated client lives in tmp during tests
  return import('../tmp/prisma/client');
};

// Build a pg.Pool whose clients route queries through pg-testkit while preserving transaction commands.
const buildTestkitPool = (pgUri: string, ...fixtures: PgFixture[]): Pool => {
  class TestkitClient extends Client {
    private readonly testkit = createPgTestkitClient({
      connectionFactory: async () => {
        const baseQuery = Client.prototype.query as (
          queryTextOrConfig: PgQueryInput,
          values?: unknown[]
        ) => Promise<QueryResult<QueryResultRow>>;
        const connection: PgQueryable = {
          query: <T extends QueryResultRow = QueryResultRow>(
            queryTextOrConfig: PgQueryInput,
            values?: unknown[]
          ) => baseQuery.call(this, queryTextOrConfig as never, values) as Promise<QueryResult<T>>,
        };

        // Let pg-testkit execute rewritten SQL via the raw client so transactional commands stay untouched.
        return connection;
      },
      fixtures,
    });

    public override query<T extends Submittable>(queryStream: T): T;
    public override query<R extends any[] = any[], I = any[]>(
      queryConfig: QueryArrayConfig<I>,
      values?: QueryConfigValues<I>
    ): Promise<QueryArrayResult<R>>;
    public override query<R extends QueryResultRow = any, I = any>(
      queryConfig: QueryConfig<I>
    ): Promise<QueryResult<R>>;
    public override query<R extends QueryResultRow = any, I = any[]>(
      queryTextOrConfig: string | QueryConfig<I>,
      values?: QueryConfigValues<I>
    ): Promise<QueryResult<R>>;
    public override query<R extends QueryResultRow = any, I = any[]>(
      queryTextOrConfig: string,
      values: QueryConfigValues<I>,
      callback: (err: Error, result: QueryResult<R>) => void
    ): void;
    public override query<R extends QueryResultRow = any, I = any[]>(
      queryTextOrConfig: string | QueryConfig<I>,
      callback: (err: Error, result: QueryResult<R>) => void
    ): void;
    public override query(...args: unknown[]): unknown {
      const [
        queryTextOrConfig,
        valuesOrCallback,
        callbackOrUndefined,
      ] = args as [
        string | { text: string; values?: unknown[]; params?: unknown[] },
        unknown[] | ((err: Error, result: QueryResult<QueryResultRow>) => void) | undefined,
        ((err: Error, result: QueryResult<QueryResultRow>) => void) | undefined
      ];
      const callback =
        typeof valuesOrCallback === 'function' ? valuesOrCallback : callbackOrUndefined;
      const values = typeof valuesOrCallback === 'function' ? undefined : valuesOrCallback;
      const sqlText = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      const configPayload =
        typeof queryTextOrConfig === 'string' ? undefined : queryTextOrConfig;
      const normalizedValues = values ?? configPayload?.values ?? configPayload?.params;

      if (sqlText && /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/i.test(sqlText)) {
        return Client.prototype.query.apply(this, args as any);
      }

      const execution = this.testkit.query(
        queryTextOrConfig as PgQueryInput,
        normalizedValues
      );

      if (typeof callback === 'function') {
        execution
          .then((result) => callback(null as unknown as Error, result))
          .catch((error) => callback(error as Error, undefined as unknown as QueryResult<QueryResultRow>));
        return undefined;
      }

      return execution;
    }
  }

  const poolConfig: PoolConfig = { connectionString: pgUri, Client: TestkitClient };
  return new Pool(poolConfig);
};

describe('UserRepository (Prisma) with pg-testkit driver adapter', () => {
  let baseClient: Client | undefined;
  let prismaPool: Pool | undefined;
  let prisma: PrismaClientType | undefined;
  let repository: UserRepository | undefined;

  beforeAll(async () => {
    const pgUri = inject('TEST_PG_URI') ?? process.env.TEST_PG_URI;
    if (!pgUri) {
      throw new Error('TEST_PG_URI is missing; ensure the Vitest global setup provided a connection.');
    }

    baseClient = new Client({ connectionString: pgUri });
    await baseClient.connect();

    // Materialize the physical table so Prisma defaults (like serial sequences) exist even though fixtures drive reads.
    await baseClient.query(`
      CREATE TABLE IF NOT EXISTS users_prisma (
        id serial PRIMARY KEY,
        email text NOT NULL UNIQUE,
        active bool NOT NULL DEFAULT true
      );
    `);
    await baseClient.query('TRUNCATE TABLE users_prisma RESTART IDENTITY;');

    ensurePrismaClient(pgUri);

    prismaPool = buildTestkitPool(pgUri, userFixture);

    const prismaModule = await importPrismaClient();
    const adapter = new PrismaPg(prismaPool);
    prisma = new prismaModule.PrismaClient({
      adapter,
      log: [{ emit: 'event', level: 'query' }],
    }) as PrismaClientType;
    repository = new UserRepository(prisma);
  });

  afterAll(async () => {
    await Promise.all([
      (prisma as { $disconnect?: () => Promise<void> })?.$disconnect?.(),
      prismaPool?.end(),
    ]);
    if (baseClient) {
      await baseClient.end();
    }
  });

  it('createUser returns a Prisma user shape', async () => {
    const created = await repository!.createUser({ email: 'carol@example.com', active: true });
    expect(created).toMatchObject({ email: 'carol@example.com', active: true });
    expect(typeof (created as { id?: unknown }).id).toBe('number');
  });

  it('findById surfaces fixture-backed rows', async () => {
    const found = await repository!.findById(1);
    expect(found).toEqual({ id: 1, email: 'alice@example.com', active: true });
  });

  it('updateActive returns Prisma BatchPayload counts', async () => {
    const updated = await repository!.updateActive(2, true);
    expect(updated.count).toBe(1);

    const updatedMissing = await repository!.updateActive(99, true);
    expect(updatedMissing.count).toBe(0);
  });

  it('deleteById returns Prisma BatchPayload counts', async () => {
    const deleted = await repository!.deleteById(2);
    expect(deleted.count).toBe(1);

    const deletedMissing = await repository!.deleteById(99);
    expect(deletedMissing.count).toBe(0);
  });
});
