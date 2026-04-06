import { config } from 'dotenv';

config();

const dbPort = process.env.ZTD_DB_PORT?.trim();

if (dbPort) {
  // The starter flow treats ZTD_DB_PORT as the source of truth so docker compose and Vitest
  // stay aligned even if an older ZTD_TEST_DATABASE_URL is still hanging around.
  process.env.ZTD_TEST_DATABASE_URL = `postgres://ztd:ztd@localhost:${dbPort}/ztd`;
} else if (!process.env.ZTD_TEST_DATABASE_URL) {
  process.env.ZTD_TEST_DATABASE_URL = 'postgres://ztd:ztd@localhost:5432/ztd';
}
