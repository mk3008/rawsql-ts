import { config } from 'dotenv';
import { resolve } from 'node:path';

const envFile = resolve(__dirname, '..', '.env.demo');
config({ path: envFile });

export const getDemoPostgresUrl = (): string | undefined => {
  return process.env.POSTGRES_URL;
};
