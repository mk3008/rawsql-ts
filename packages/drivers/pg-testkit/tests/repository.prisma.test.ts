import { Client, Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createPgTestkitPool } from '../src';
import type { PgFixture } from '../src';
import type { PrismaClientType } from './prisma-app/prisma-client-shim';
import { UserRepository } from './prisma-app/UserRepository';

declare module 'vitest' {
  interface ProvidedContext {
    TEST_PG_URI: string;
  }
}

// Prisma emits schema-qualified table names; fixtures use the same qualified identifiers,
// and TableNameUtils only normalizes quotes/casing instead of guessing search_path.
const userFixture: PgFixture = {
  tableName: 'public.users_prisma',
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

    // Materialize the physical table so Prisma defaults (like serial sequences) exist,
    // while reads and logical behavior still come from fixtures via pg-testkit.
    await baseClient.query(`
    CREATE TABLE IF NOT EXISTS public.users_prisma (
        id serial PRIMARY KEY,
        email text NOT NULL UNIQUE,
        active bool NOT NULL DEFAULT true
      );
    `);
    await baseClient.query('TRUNCATE TABLE public.users_prisma RESTART IDENTITY;');

    ensurePrismaClient(pgUri);

    prismaPool = createPgTestkitPool(pgUri, userFixture);

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
