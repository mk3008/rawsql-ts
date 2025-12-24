import { Pool, PoolClient } from 'pg';
import { BenchContext, logBenchPhase, logPoolStats } from './benchmark-logger';

const DEFAULT_PARALLEL_WORKERS = 4;
const DEFAULT_POOL_INCREMENT = 2;
const DEFAULT_POOL_MULTIPLIER = 8;

let pool: Pool | undefined;
const workerConnections = new Map<string, PoolClient>();

type DbClientScope = 'worker' | 'case';

/**
 * Options for acquiring a database client from the shared benchmark pool.
 */
export type AcquireDbClientOptions = {
  scope: DbClientScope;
  workerId?: string;
  applicationName?: string;
  context?: BenchContext;
};

/**
 * A database connection taken from the shared benchmark pool.
 */
export type DbConnection = {
  client: PoolClient;
  pid: number;
  release: () => Promise<void>;
  acquireMs?: number;
};

function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL;
  if (configured && configured.length > 0) {
    return configured;
  }
  throw new Error('DATABASE_URL is required to acquire a benchmark database client.');
}

function resolvePoolMax(): number {
  const configuredWorkers = Number(process.env.ZTD_BENCH_WORKERS ?? DEFAULT_PARALLEL_WORKERS);
  const preferredByWorkers =
    configuredWorkers > 0 ? configuredWorkers * DEFAULT_POOL_MULTIPLIER : DEFAULT_PARALLEL_WORKERS;
  const fallback = configuredWorkers > 0 ? configuredWorkers + DEFAULT_POOL_INCREMENT : DEFAULT_PARALLEL_WORKERS;
  const configuredMax = Number(process.env.ZTD_BENCH_POOL_MAX);
  if (Number.isFinite(configuredMax) && configuredMax > 0) {
    return Math.max(1, Math.floor(configuredMax));
  }
  return Math.max(1, Math.max(preferredByWorkers, fallback));
}

function ensurePool(): Pool {
  if (pool) {
    return pool;
  }
  pool = new Pool({
    connectionString: resolveDatabaseUrl(),
    max: resolvePoolMax(),
  });
  return pool;
}

async function fetchBackendPid(client: PoolClient): Promise<number> {
  const result = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
  return result.rows[0]?.pid ?? 0;
}

async function configureApplicationName(client: PoolClient, applicationName: string): Promise<void> {
  if (!applicationName) {
    return;
  }
  const sanitized = applicationName.replace(/'/g, "''");
  await client.query(`SET application_name = '${sanitized}'`);
}

function resolveWorkerToken(workerId?: string): string {
  if (workerId && workerId.length > 0) {
    return workerId;
  }
  throw new Error('workerId is required for worker-scoped benchmark clients.');
}

async function prepareWorkerClient(
  workerToken: string,
  applicationName: string,
  context?: BenchContext,
): Promise<DbConnection> {
  const start = process.hrtime.bigint();
  // Reuse the worker's client if it already exists; otherwise grab a fresh connection.
  const client = workerConnections.get(workerToken) ?? (await ensurePool().connect());
  if (!workerConnections.has(workerToken)) {
    workerConnections.set(workerToken, client);
  }
  const acquireMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  logPoolStats(ensurePool(), context ?? {}, 'worker-configured');
  await configureApplicationName(client, applicationName);
  const pid = await fetchBackendPid(client);
  return {
    client,
    pid,
    release: async () => Promise.resolve(),
    acquireMs,
  };
}

async function prepareCaseClient(applicationName: string, context?: BenchContext): Promise<DbConnection> {
  const start = process.hrtime.bigint();
  // Case-local scopes always grab a new pool connection so parallel cases stay isolated.
  const poolClient = await ensurePool().connect();
  const acquireMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  await configureApplicationName(poolClient, applicationName);
  logPoolStats(ensurePool(), context ?? {}, 'case-acquired');
  const pid = await fetchBackendPid(poolClient);
  return {
    client: poolClient,
    pid,
    release: async () => {
      poolClient.release();
    },
    acquireMs,
  };
}

/**
 * Acquire a database client from the shared benchmark pool.
 */
export async function getDbClient(options: AcquireDbClientOptions): Promise<DbConnection> {
  const applicationName = options.applicationName ?? 'ztd-bench';
  if (options.scope === 'worker') {
    if (!options.workerId || options.workerId.length === 0) {
      throw new Error('workerId must be specified for worker-scoped benchmark clients.');
    }
    // Worker identities must be explicit so we do not reuse tokens that serialize parallel runs.
    const workerToken = resolveWorkerToken(options.workerId);
    logBenchPhase('acquireClient', 'start', options.context ?? {}, {
      scope: 'worker',
      workerToken,
    });
    const connection = await prepareWorkerClient(workerToken, applicationName, options.context);
    logBenchPhase(
      'acquireClient',
      'end',
      options.context ?? {},
      {
        waitingMs: connection.acquireMs ?? 0,
        scope: 'worker',
        workerToken,
      },
    );
    return connection;
  }
  logBenchPhase('acquireClient', 'start', options.context ?? {}, {
    scope: 'case',
  });
  const connection = await prepareCaseClient(applicationName, options.context);
  logBenchPhase(
    'acquireClient',
    'end',
    options.context ?? {},
    {
      waitingMs: connection.acquireMs ?? 0,
      scope: 'case',
    },
  );
  return connection;
}

/**
 * Release the worker-scoped client associated with a token.
 */
export async function releaseWorkerClient(workerId?: string): Promise<void> {
  const workerToken = resolveWorkerToken(workerId);
  const client = workerConnections.get(workerToken);
  if (!client) {
    return;
  }
  workerConnections.delete(workerToken);
  client.release();
}

/**
 * Close the shared benchmark pool and free any held worker clients.
 */
export async function closeDbPool(): Promise<void> {
  for (const [workerToken, client] of workerConnections.entries()) {
    workerConnections.delete(workerToken);
    client.release();
  }
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
