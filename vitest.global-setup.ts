import { PostgreSqlContainer } from '@testcontainers/postgresql';

interface GlobalSetupContextLike {
  provide: (key: string, value: string) => void;
}

export default async function setupGlobalPostgres({ provide }: GlobalSetupContextLike) {
  // Start a shared Postgres container for the entire Vitest run.
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  provide('TEST_PG_URI', container.getConnectionUri());
  process.env.TEST_PG_URI = container.getConnectionUri();

  return async () => {
    // Ensure the container is stopped after all suites complete.
    await container.stop();
  };
}
