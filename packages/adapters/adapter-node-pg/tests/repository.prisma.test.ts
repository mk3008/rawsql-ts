import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { usersPrismaTableDefinition } from './fixtures/TableDefinitions';
import { UserRepository } from './prisma-app/UserRepository';
import { createPgTestkitFixtureRunner } from './helpers/pgFixtureRunner';
import { createPrismaRepositoryTestHarness } from './helpers/prismaRepositoryTestHarness';
import { createPgTestkitPool } from '../src';

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

/**
 * Creates a fixture object representing the logical contents of the table.
 * Tests rely entirely on these rows instead of real database tables.
 */
const buildUserRows = (rows: UserFixtureRow[]) => ({
  tableName: 'public.users_prisma',
  rows,
});

const fixtureRunner = createPgTestkitFixtureRunner({
  ddlRoot,
  tableDefinitions: [usersPrismaTableDefinition],
});

const fixtureRunnerWithUserRows = async (
  connectionString: string,
  rows: UserFixtureRow[],
  testFn: (pool: ReturnType<typeof createPgTestkitPool>) => Promise<void>
): Promise<void> => {
  // Convert schema-specific row arrays into the multi-table payload expected by the runner.
  const fixtures = [buildUserRows(rows)];
  await fixtureRunner(connectionString, fixtures, testFn);
};

/**
 * Ensures that Prisma Client is generated before tests run.
 *
 * The tests still use Prisma normally, so this step prepares the usual
 * Prisma-generated client. Later, the database connection behind this client
 * will be replaced by a simulation layer that responds using fixtures.
 */
const ensurePrismaClient = (databaseUrl: string): void => {
  // Skip any work when the generated client already exists for the temporary directory.
  if (existsSync(path.join(prismaClientOutput, 'index.js'))) {
    return;
  }

  // Prepare the temporary tree where Prisma will emit the client artifacts.
  mkdirSync(prismaTmpDir, { recursive: true });

  // Drive `prisma generate` so the client reflects the test schema and connection.
  execSync(
    `pnpm --filter @rawsql-ts/adapter-node-pg exec prisma generate --schema "${prismaSchemaPath}" --config "${prismaConfigPath}"`,
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

/**
 * Prisma Client must be imported dynamically because it is generated during test setup.
 */
const importPrismaClient = async (): Promise<PrismaClientModule> => {
  return import('../tmp/prisma/client');
};

const prismaTestHarness = createPrismaRepositoryTestHarness<UserFixtureRow, UserRepository>({
  fixtureRunner: fixtureRunnerWithUserRows,
  ensurePrismaClient,
  importPrismaClient,
  createRepository: (client) => new UserRepository(client),
});

describe('UserRepository (Prisma) with fixture-backed Postgres simulation', () => {
  beforeAll(async () => {
    /**
     * Vitest injects a connection URL that points to a lightweight Postgres instance.
     * Although a real connection exists, the test never uses real tables.
     * Instead, all table access is simulated using fixtures and structural metadata.
     */
    const pgUri = inject('TEST_PG_URI') ?? process.env.TEST_PG_URI;
    if (!pgUri) {
      throw new Error('TEST_PG_URI is missing; ensure the Vitest global setup provided a connection.');
    }
    await prismaTestHarness.setup(pgUri);
  });

  it('createUser returns a Prisma user shape', async () => {
    /**
     * No initial rows. The simulation layer evaluates the INSERT operation
     * and generates an auto-incremented id as a real database would.
     */
    await prismaTestHarness.run([], async (repo) => {
      const created = await repo.createUser({ email: 'carol@example.com', active: true });
      expect(created).toMatchObject({ email: 'carol@example.com', active: true });
      expect(typeof (created as { id?: unknown }).id).toBe('number');
    });
  });

  it('findById reads rows from the fixture data', async () => {
    /**
     * Reads back the exact row provided by the fixture.
     * This proves SELECT queries operate on the simulated table contents.
     */
    await prismaTestHarness.run(
      [{ id: 1, email: 'alice@example.com', active: true }],
      async (repo) => {
        const found = await repo.findById(1);
        expect(found).toEqual({ id: 1, email: 'alice@example.com', active: true });
      }
    );
  });

  it('updateActive returns the correct count values', async () => {
    /**
     * UPDATE is evaluated purely using the fixture data.
     * The simulation layer determines whether the WHERE clause matches,
     * and returns the same “count” value Prisma expects from a real DB.
     */
    await prismaTestHarness.run(
      [{ id: 2, email: 'bob@example.com', active: false }],
      async (repo) => {
        const updated = await repo.updateActive(2, true);
        expect(updated.count).toBe(1);

        const updatedMissing = await repo.updateActive(99, true);
        expect(updatedMissing.count).toBe(0);
      }
    );
  });

  it('deleteById returns the correct count values', async () => {
    /**
     * DELETE behaves the same way: only fixture rows determine the result.
     * No real table is touched.
     */
    await prismaTestHarness.run(
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
