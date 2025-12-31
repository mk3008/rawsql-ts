import { Pool, PoolClient } from 'pg';
import { BenchContext, logBenchDebug, logBenchPhase, logPoolStats } from './benchmark-logger';

const DEFAULT_PARALLEL_WORKERS = 4;
const DEFAULT_POOL_INCREMENT = 2;
const DEFAULT_POOL_MULTIPLIER = 8;
const DEFAULT_POOL_END_TIMEOUT_MS = 2_000;

let pool: Pool | undefined;

export type AcquireDbClientOptions = {
  applicationName?: string;
  context?: BenchContext;
  scope?: 'case' | 'worker';
  workerId?: string;
};

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

function resolvePoolEndTimeoutMs(): number {
  const configured = Number(process.env.ZTD_BENCH_POOL_END_TIMEOUT_MS ?? DEFAULT_POOL_END_TIMEOUT_MS);
  if (!Number.isFinite(configured)) {
    return DEFAULT_POOL_END_TIMEOUT_MS;
  }
  return Math.max(0, Math.floor(configured));
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

function getPoolClients(targetPool: Pool): PoolClient[] {
  const poolAny = targetPool as unknown as {
    _clients?: PoolClient[];
    _idle?: PoolClient[];
  };
  const clients = new Set<PoolClient>();
  (poolAny._clients ?? []).forEach((client) => clients.add(client));
  (poolAny._idle ?? []).forEach((client) => clients.add(client));
  return Array.from(clients);
}

type PoolClientSnapshot = {
  pid?: number;
  applicationName?: string;
  isIdle: boolean;
};

function snapshotPoolClients(targetPool: Pool): PoolClientSnapshot[] {
  const poolAny = targetPool as unknown as {
    _clients?: PoolClient[];
    _idle?: PoolClient[];
  };
  const idleClients = new Set<PoolClient>(poolAny._idle ?? []);
  return getPoolClients(targetPool).map((client) => {
    const clientAny = client as unknown as {
      processID?: number;
      connection?: { parameters?: { application_name?: string } };
    };
    return {
      pid: clientAny.processID,
      applicationName: clientAny.connection?.parameters?.application_name,
      isIdle: idleClients.has(client),
    };
  });
}

async function configureApplicationName(client: PoolClient, applicationName: string): Promise<void> {
  if (!applicationName) {
    return;
  }
  const sanitized = applicationName.replace(/'/g, "''");
  await client.query(`SET application_name = '${sanitized}'`);
}

function resolveBackendPid(client: PoolClient): number {
  const clientAny = client as unknown as { processID?: number };
  return clientAny.processID ?? 0;
}

async function prepareCaseClient(applicationName: string, context?: BenchContext): Promise<DbConnection> {
  const start = process.hrtime.bigint();
  logBenchDebug({
    event: 'open-case-client',
    scope: 'case',
    applicationName,
  });
  // Acquire a fresh pool client for every request so parallel cases remain isolated.
  const poolClient = await ensurePool().connect();
  const acquireMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  await configureApplicationName(poolClient, applicationName);
  const pid = resolveBackendPid(poolClient);
  logBenchDebug({
    event: 'case-client-configured',
    scope: 'case',
    applicationName,
    pid,
  });
  logPoolStats(ensurePool(), context ?? {}, 'case-acquired');
  return {
    client: poolClient,
    pid,
    acquireMs,
    release: async () => {
      poolClient.release();
    },
  };
}

export async function getDbClient(options: AcquireDbClientOptions): Promise<DbConnection> {
  const applicationName = options.applicationName ?? 'ztd-bench';
  const context: BenchContext = options.context ?? {};
  const scope = options.scope ?? 'case';
  logBenchPhase('acquireClient', 'start', context, {
    scope,
  });
  // Acquire a disposable connection so no work is shared between cases/workers.
  const connection = await prepareCaseClient(applicationName, options.context);
  logBenchPhase('acquireClient', 'end', context, {
    waitingMs: connection.acquireMs ?? 0,
    scope,
  });
  return connection;
}

export async function releaseWorkerClient(token: string): Promise<void> {
  logBenchDebug({
    event: 'release-worker-client',
    token,
  });
}

export async function closeDbPool(): Promise<void> {
  if (!pool) {
    return;
  }
  const targetPool = pool;
  pool = undefined;
  // Capture the current pool counts so diagnostics explain what was still checked out.
  const poolCounts = {
    totalCount: targetPool.totalCount,
    idleCount: targetPool.idleCount,
    waitingCount: targetPool.waitingCount,
  };
  logBenchDebug({
    event: 'closing-pool',
    ...poolCounts,
  });
  const timeoutMs = resolvePoolEndTimeoutMs();
  const endPromise = targetPool.end();
  if (timeoutMs > 0) {
    // Fail fast if the pool does not end within the configured timeout window.
    const endSignal = endPromise.then(() => true).catch(() => true);
    const timeoutSignal = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), timeoutMs);
    });
    const ended = await Promise.race([endSignal, timeoutSignal]);
    if (!ended) {
      const snapshot = snapshotPoolClients(targetPool);
      logBenchDebug({
        event: 'closing-pool-timeout',
        timeoutMs,
        ...poolCounts,
        clients: snapshot,
      });
      const errorMessage = `[bench] Pool shutdown timed out after ${timeoutMs}ms; total=${poolCounts.totalCount}, idle=${poolCounts.idleCount}, waiting=${poolCounts.waitingCount}; clients=${JSON.stringify(snapshot)}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
  await endPromise;
}
