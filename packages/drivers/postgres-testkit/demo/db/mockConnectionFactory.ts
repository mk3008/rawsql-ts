import { Client } from 'pg';
import type { PostgresConnectionLike } from '../../src/types';
import { getDemoPostgresUrl } from '../runtime/postgresConfig';

const buildConnectionString = (): string => {
  const url = getDemoPostgresUrl();
  // Fail fast so the manual demo run surfaces a clear configuration requirement.
  if (!url) {
    throw new Error('POSTGRES_URL must be defined in .env.demo to run the Postgres demo tests.');
  }
  return url;
};

export const createDemoPostgresConnection = async (): Promise<PostgresConnectionLike> => {
  const client = new Client({ connectionString: buildConnectionString() });
  // Open the database session before passing the client back to the caller.
  await client.connect();
  return client;
};

