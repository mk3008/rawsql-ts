import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { config } from 'dotenv';

export default async function globalSetup() {
  config();

  if (process.env.ZTD_DB_URL) {
    return () => undefined;
  }

  const container = await startPostgresContainer();
  process.env.ZTD_DB_URL = container.getConnectionUri();

  return async () => {
    await container.stop();
  };
}

async function startPostgresContainer(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer('postgres:18')
    .withDatabase('ztd')
    .withUsername('ztd')
    .withPassword('ztd')
    .start();
}
