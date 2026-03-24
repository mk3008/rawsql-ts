import { config } from 'dotenv';

config();

if (!process.env.ZTD_TEST_DATABASE_URL) {
  const port = process.env.ZTD_DB_PORT?.trim() || '5432';
  process.env.ZTD_TEST_DATABASE_URL = `postgres://ztd:ztd@localhost:${port}/ztd`;
}
