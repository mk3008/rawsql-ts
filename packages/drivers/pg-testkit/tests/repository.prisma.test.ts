import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { createPgTestkitPool } from '../src';
import { usersPrismaTableDefinition } from './fixtures/TableDefinitions';
import type { PrismaClientType } from './prisma-app/prisma-client-shim';
import { UserRepository } from './prisma-app/UserRepository';

declare module 'vitest' {
  interface ProvidedContext {
    TEST_PG_URI: string;
  }
}

const prismaTmpDir = path.resolve(__dirname, '../tmp/prisma');
const prismaClientOutput = path.join(prismaTmpDir, 'client');
const prismaSchemaPath = path.resolve(__dirname, './prisma-app/schema.prisma');
const prismaConfigPath = path.resolve(__dirname, '../prisma.config.ts');
const ddlRoot = path.resolve(__dirname, 'ddl');

type UserFixtureRow = {
  id: number;
  email: string;
  active: boolean;
};

const buildUserRows = (rows: UserFixtureRow[]) => ({
  tableName: 'public.users_prisma',
  rows,
});

const ensurePrismaClient = (databaseUrl: string): void => {
  if (existsSync(path.join(prismaClientOutput, 'index.js'))) {
    return;
  }

  mkdirSync(prismaTmpDir, { recursive: true });

  // Run the Prisma generator once so the client module can be imported by the tests.
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

type PrismaClientModule = typeof import('../tmp/prisma/client');

const importPrismaClient = async (): Promise<PrismaClientModule> => {
  return import('../tmp/prisma/client');
};

describe('UserRepository (Prisma) with pg-testkit driver adapter', () => {
  let prismaModule: PrismaClientModule | undefined;
  let testPgUri: string | undefined;

  beforeAll(async () => {
    // Capture the database URI that Vitest injects for pg-testkit.
    const pgUri = inject('TEST_PG_URI') ?? process.env.TEST_PG_URI;
    if (!pgUri) {
      throw new Error('TEST_PG_URI is missing; ensure the Vitest global setup provided a connection.');
    }
    testPgUri = pgUri;

    // Ensure the Prisma client has been generated with the current connection URL.
    ensurePrismaClient(pgUri);
    prismaModule = await importPrismaClient();
  });

  const runWithRepository = async (
    rows: UserFixtureRow[] = [],
    testFn: (repository: UserRepository) => Promise<void>
  ): Promise<void> => {
    if (!testPgUri) {
      throw new Error('TEST_PG_URI is missing; ensure beforeAll set it.');
    }
    if (!prismaModule) {
      throw new Error('Prisma Client module was not loaded before running tests.');
    }

    // Set up a pg-testkit pool with the fixture rows and DDL metadata so Prisma sees the expected schema.
    const pool = createPgTestkitPool(
      testPgUri,
      buildUserRows(rows),
      {
        ddl: { directories: [ddlRoot] },
        tableDefinitions: [usersPrismaTableDefinition],
      }
    );

    const adapter = new PrismaPg(pool);
    const prismaClient = new prismaModule.PrismaClient({
      adapter,
      log: [{ emit: 'event', level: 'query' }],
    }) as unknown as PrismaClientType;
    const repository = new UserRepository(prismaClient);

    // Ensure we always disconnect the Prisma client and close the pool, even if the test throws.
    try {
      await testFn(repository);
    } finally {
      await prismaClient.$disconnect();
      await pool.end();
    }
  };

  it('createUser returns a Prisma user shape', async () => {
    await runWithRepository([], async (repo) => {
      const created = await repo.createUser({ email: 'carol@example.com', active: true });
      expect(created).toMatchObject({ email: 'carol@example.com', active: true });
      expect(typeof (created as { id?: unknown }).id).toBe('number');
    });
  });

  it('findById surfaces fixture-backed rows', async () => {
    await runWithRepository(
      [{ id: 1, email: 'alice@example.com', active: true }],
      async (repo) => {
        const found = await repo.findById(1);
        expect(found).toEqual({ id: 1, email: 'alice@example.com', active: true });
      }
    );
  });

  it('updateActive returns Prisma BatchPayload counts', async () => {
    await runWithRepository(
      [{ id: 2, email: 'bob@example.com', active: false }],
      async (repo) => {
        const updated = await repo.updateActive(2, true);
        expect(updated.count).toBe(1);

        const updatedMissing = await repo.updateActive(99, true);
        expect(updatedMissing.count).toBe(0);
      }
    );
  });

  it('deleteById returns Prisma BatchPayload counts', async () => {
    await runWithRepository(
      [{ id: 2, email: 'bob@example.com', active: false }],
      async (repo) => {
        const deleted = await repo.deleteById(2);
        expect(deleted.count).toBe(1);

        const deletedMissing = await repo.deleteById(99);
        expect(deletedMissing.count).toBe(0);
      }
    );
  });
});
