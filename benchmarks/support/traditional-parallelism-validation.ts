import type { DbConnection } from './db-client';
import { getDbClient } from './db-client';
import { safeStopSampler, SessionSampler } from './session-sampler';

type Barrier = {
  wait: () => Promise<void>;
};

/** Summary of the lightweight traditional parallelism validation run. */
export type TraditionalParallelismSummary = {
  workerCount: number;
  maxTotalSessions: number;
  maxActiveSessions: number;
  sampleCount: number;
  workerPids: Map<string, number>;
};

/** Inputs used to tune the parallelism validation scenario. */
export type TraditionalParallelismConfig = {
  workerCount: number;
  workerApplicationNamePrefix?: string;
  sleepSeconds?: number;
};

/**
 * Executes a concurrent pg_sleep workload across worker-scoped clients to prove that multiple
 * PostgreSQL sessions can be active at the same time.
 */
export async function runTraditionalParallelismValidation(
  config: TraditionalParallelismConfig,
): Promise<TraditionalParallelismSummary> {
  const requestedWorkers = Math.floor(config.workerCount);
  if (!Number.isFinite(requestedWorkers) || requestedWorkers <= 0) {
    throw new Error('workerCount must be a positive integer when validating traditional parallelism.');
  }

  const workerApplicationNamePrefix =
    config.workerApplicationNamePrefix ?? 'ztd-bench-traditional-validation';
  const rawSleepSeconds = Number.isFinite(config.sleepSeconds ?? 0.3) ? config.sleepSeconds! : 0.3;
  const sleepSeconds = rawSleepSeconds > 0 ? rawSleepSeconds : 0.3;
  const workerIds = Array.from({ length: requestedWorkers }, (_, index) => `${workerApplicationNamePrefix}-${index}`);
  const barrier = createBarrier(requestedWorkers);
  const sampler = new SessionSampler();
  await sampler.start();
  const workerPids = new Map<string, number>();
  let samplerSummary = { maxTotal: 0, maxActive: 0, sampleCount: 0 };
  try {
    await Promise.all(
      workerIds.map((workerId) =>
        executeValidationWorker(workerId, sleepSeconds, barrier, workerPids, workerApplicationNamePrefix),
      ),
    );
  } finally {
    samplerSummary = await safeStopSampler(sampler);
  }
  return {
    workerCount: requestedWorkers,
    maxTotalSessions: samplerSummary.maxTotal,
    maxActiveSessions: samplerSummary.maxActive,
    sampleCount: samplerSummary.sampleCount,
    workerPids,
  };
}

async function executeValidationWorker(
  workerId: string,
  sleepSeconds: number,
  barrier: Barrier,
  workerPids: Map<string, number>,
  workerApplicationNamePrefix: string,
): Promise<void> {
  let connection: DbConnection | undefined;
  try {
    const applicationName = `${workerApplicationNamePrefix}-${workerId}`;
    connection = await getDbClient({
      applicationName,
    });
    const result = await connection.client.query<{ pid: number }>(
      'SELECT pg_backend_pid() AS pid',
    );
    const pid = Number(result.rows[0]?.pid ?? 0);
    workerPids.set(workerId, pid);
    // Hold each worker at the barrier so that all pg_sleep calls overlap.
    await barrier.wait();
    await connection.client.query('SELECT pg_sleep($1)', [sleepSeconds]);
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

function createBarrier(participants: number): Barrier {
  if (participants <= 0) {
    throw new Error('Barrier requires at least one participant.');
  }
  let arrivals = 0;
  let release: (() => void) | null = null;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    async wait() {
      arrivals += 1;
      if (arrivals === participants && release) {
        release();
        release = null;
      }
      await ready;
    },
  };
}
