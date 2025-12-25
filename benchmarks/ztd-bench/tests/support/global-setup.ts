import fs from 'node:fs';
import path from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { closeDbPool } from '../../../support/db-client';

/**
 * Vitest global setup.
 *
 * ZTD tests are safe to run in parallel against a single Postgres instance because pg-testkit
 * rewrites CRUD into fixture-backed SELECT queries (no physical tables are created/mutated).
 *
 * This setup starts exactly one disposable Postgres container when DATABASE_URL is not provided,
 * and shares the resulting DATABASE_URL with all Vitest workers.
 */
export default async function globalSetup() {
  const executionStart = process.hrtime.bigint();
  const configuredUrl = process.env.DATABASE_URL;
  if (configuredUrl && configuredUrl.length > 0) {
    return async () => {
      await closeDbPool();
      writeExecutionMetrics(executionStart);
    };
  }

  const container = new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('ztd_bench')
    .withUsername('postgres')
    .withPassword('postgres');

  const started = await container.start();
  process.env.DATABASE_URL = started.getConnectionUri();

  return async () => {
    await closeDbPool();
    writeExecutionMetrics(executionStart);
    await started.stop();
  };
}

function writeExecutionMetrics(executionStart: bigint): void {
  const prefix = process.env.ZTD_BENCH_METRICS_PREFIX;
  if (!prefix) {
    return;
  }

  const executionMs = Number(process.hrtime.bigint() - executionStart) / 1_000_000;
  const filePath = `${prefix}-execution.json`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ executionMs }, null, 2), 'utf8');
}

