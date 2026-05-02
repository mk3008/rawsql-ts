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

const poolMin = readPoolSize('RAWSQL_PG_POOL_MIN', 0);
const poolMax = readPoolSize('RAWSQL_PG_POOL_MAX', 10);

if (poolMin > poolMax) {
  throw new Error(`RAWSQL_PG_POOL_MIN (${poolMin}) must be less than or equal to RAWSQL_PG_POOL_MAX (${poolMax}).`);
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  min: poolMin,
  max: poolMax,
});
