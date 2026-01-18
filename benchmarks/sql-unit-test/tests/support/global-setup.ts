import { PostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Vitest global setup.
 *
 * ZTD tests are safe to run in parallel against a single Postgres instance because testkit-postgres
 * rewrites CRUD into fixture-backed SELECT queries (no physical tables are created/mutated).
 *
 * This setup starts exactly one disposable Postgres container when DATABASE_URL is not provided,
 * and shares the resulting DATABASE_URL with all Vitest workers.
 */
export default async function globalSetup() {
  const configuredUrl = process.env.DATABASE_URL;
  if (configuredUrl && configuredUrl.length > 0) {
    return () => undefined;
  }

  const container = new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('ztd_playground')
    .withUsername('postgres')
    .withPassword('postgres');

  const started = await container.start();
  process.env.DATABASE_URL = started.getConnectionUri();

  return async () => {
    await started.stop();
  };
}

