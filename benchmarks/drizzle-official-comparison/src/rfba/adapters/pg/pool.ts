import pg from 'pg';

function readPoolSize(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  min: readPoolSize('RAWSQL_PG_POOL_MIN', 0),
  max: readPoolSize('RAWSQL_PG_POOL_MAX', 10),
});
