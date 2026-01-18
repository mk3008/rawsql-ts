import { PrismaPg } from '@prisma/adapter-pg';
import { createPgTestkitPool } from '../../src';
import type { PrismaClientType } from '../prisma-app/prisma-client-shim';

type FixtureRunner<Row> = (
  connectionString: string,
  rows: Row[],
  testFn: (pool: ReturnType<typeof createPgTestkitPool>) => Promise<void>
) => Promise<void>;

interface PrismaClientModule {
  PrismaClient: new (...args: any[]) => PrismaClientType;
}

interface PrismaRepositoryTestHarnessOptions<Row, Repository> {
  fixtureRunner: FixtureRunner<Row>;
  ensurePrismaClient: (databaseUrl: string) => void;
  importPrismaClient: () => Promise<PrismaClientModule>;
  createRepository: (client: PrismaClientType) => Repository;
}

export interface PrismaRepositoryTestHarness<Row, Repository> {
  setup(databaseUrl: string): Promise<void>;
  run(rows: Row[], testFn: (repository: Repository) => Promise<void>): Promise<void>;
}

export const createPrismaRepositoryTestHarness = <Row, Repository>({
  fixtureRunner,
  ensurePrismaClient,
  importPrismaClient,
  createRepository,
}: PrismaRepositoryTestHarnessOptions<Row, Repository>): PrismaRepositoryTestHarness<Row, Repository> => {
  let prismaModule: PrismaClientModule | undefined;
  let currentDatabaseUrl: string | undefined;

  const setup = async (databaseUrl: string): Promise<void> => {
    // Persist the URI so subsequent runs share the same test server target.
    currentDatabaseUrl = databaseUrl;

    // Generate the Prisma client artifacts once before any test invokes them.
    ensurePrismaClient(databaseUrl);

    // Load the freshly generated client module for run-time usage.
    prismaModule = await importPrismaClient();
  };

  const run = async (rows: Row[] = [], testFn: (repository: Repository) => Promise<void>): Promise<void> => {
    if (!currentDatabaseUrl) {
      throw new Error('Prisma repository harness was not initialized; call setup() before running tests.');
    }
    // Keep a local reference after the guard so TypeScript knows the module cannot be undefined.
    const prismaModuleInstance = prismaModule;
    if (!prismaModuleInstance) {
      throw new Error('Prisma client module is missing; ensure setup() has completed successfully.');
    }

    return fixtureRunner(currentDatabaseUrl, rows, async (pool) => {
      // Route all Prisma traffic through the pg-testkit pool adapter for simulation.
      const adapter = new PrismaPg(pool);
      const prismaClient = new prismaModuleInstance.PrismaClient({
        adapter,
        log: [{ emit: 'event', level: 'query' }],
      }) as unknown as PrismaClientType;

      const repository = createRepository(prismaClient);

      try {
        await testFn(repository);
      } finally {
        // Always disconnect so database connections cannot leak between tests.
        await prismaClient.$disconnect();
      }
    });
  };

  return { setup, run };
};
