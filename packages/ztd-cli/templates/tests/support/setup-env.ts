import { config } from 'dotenv';

config();

const starterDbEnv = {
  host: readRequiredEnv('ZTD_DB_HOST'),
  port: readRequiredEnv('ZTD_DB_PORT'),
  name: readRequiredEnv('ZTD_DB_NAME'),
  user: readRequiredEnv('ZTD_DB_USER'),
  pass: readRequiredEnv('ZTD_DB_PASS')
} as const;

const derivedConnectionString = buildStarterConnectionString(starterDbEnv);
const existingConnectionString = process.env.ZTD_TEST_DATABASE_URL?.trim();
if (existingConnectionString && existingConnectionString !== derivedConnectionString) {
  throw new Error(
    'ZTD_TEST_DATABASE_URL conflicts with the starter DB settings in .env. Remove it and rely on ZTD_DB_HOST, ZTD_DB_PORT, ZTD_DB_NAME, ZTD_DB_USER, and ZTD_DB_PASS.'
  );
}

process.env.ZTD_TEST_DATABASE_URL = derivedConnectionString;

function readRequiredEnv(name: 'ZTD_DB_HOST' | 'ZTD_DB_PORT' | 'ZTD_DB_NAME' | 'ZTD_DB_USER' | 'ZTD_DB_PASS'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name} in .env before running the starter DB-backed tests.`);
  }
  return value;
}

function buildStarterConnectionString(env: Readonly<{
  host: string;
  port: string;
  name: string;
  user: string;
  pass: string;
}>): string {
  return `postgres://${encodeURIComponent(env.user)}:${encodeURIComponent(env.pass)}@${env.host}:${env.port}/${encodeURIComponent(env.name)}`;
}
