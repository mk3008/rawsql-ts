import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

const PG_STAT_QUERY = `
SELECT
  pid,
  usename,
  application_name,
  state,
  wait_event_type,
  wait_event,
  query_start,
  xact_start,
  query
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY pid ASC
`;

const DEFAULT_INTERVAL_MS = 500;
/**
 * Determine how frequently the concurrency monitor should poll pg_stat_activity.
 * Respect an explicit option first but allow an override via environment when needed.
 */
export function resolveConcurrencyInterval(explicit?: number): number {
  const envValue = Number(process.env.PG_CONCURRENCY_INTERVAL_MS ?? '');
  if (Number.isFinite(envValue) && envValue > 0) {
    return Math.max(10, Math.floor(envValue));
  }
  if (Number.isFinite(explicit ?? NaN) && explicit !== undefined && explicit > 0) {
    return Math.floor(explicit);
  }
  return DEFAULT_INTERVAL_MS;
}
const MAX_QUERY_TEXT = 512;

export type PgConcurrencyRow = {
  pid: number;
  usename: string;
  applicationName: string | null;
  state: string | null;
  waitEventType: string | null;
  waitEvent: string | null;
  queryStart: string | null;
  xactStart: string | null;
  query: string | null;
};

export type PgConcurrencyTimelineEntry = {
  timestamp: string;
  totalSessions: number;
  activeSessions: number;
  activeExecutingSessions: number;
  lockWaitingSessions: number;
  waitTypeCounts: Record<string, number>;
  rows: PgConcurrencyRow[];
};

export type PgConcurrencySummary = {
  jsonPath: string;
  mdPath: string;
  maxTotalSessions: number;
  maxActiveSessions: number;
  maxActiveExecutingSessions: number;
  maxLockWaitSessions: number;
  totalPolls: number;
  waitEventTotals: Record<string, number>;
  timelineSample: PgConcurrencyTimelineEntry[];
  byApplication: Record<string, PgConcurrencyApplicationSummary>;
  distinctBackendPidsByMethod: Record<string, number>;
  distinctBackendPidsByWorkerTag: Record<string, number>;
};

export type PgConcurrencyApplicationSummary = {
  maxConcurrentSessions: number;
  maxActiveSessions: number;
  maxActiveExecutingSessions: number;
  sampleCount: number;
};

type MonitorOptions = {
  connectionString: string;
  intervalMs?: number;
  outputDir: string;
};

const WORKER_TAG_PATTERN = /-worker-[^-]+$/;

function resolveMethodKey(applicationName: string | null): string {
  if (!applicationName || applicationName.length === 0) {
    return 'unnamed';
  }
  return applicationName.replace(WORKER_TAG_PATTERN, '');
}

function resolveWorkerTag(applicationName: string | null): string {
  if (!applicationName || applicationName.length === 0) {
    return 'unnamed';
  }
  const match = applicationName.match(WORKER_TAG_PATTERN);
  if (!match) {
    return 'shared';
  }
  return match[0].slice(1);
}

export async function startPgConcurrencyMonitor(options: MonitorOptions): Promise<{
  stop(): Promise<PgConcurrencySummary>;
}> {
  const intervalMs = resolveConcurrencyInterval(options.intervalMs);
  const pool = new Pool({
    connectionString: options.connectionString,
    max: 1,
  });

  await fs.mkdir(options.outputDir, { recursive: true });

  const timeline: PgConcurrencyTimelineEntry[] = [];
  let maxTotalSessions = 0;
  let maxActiveSessions = 0;
  let maxActiveExecutingSessions = 0;
  let maxLockWaitSessions = 0;
  let totalPolls = 0;
  const waitEventTotals: Record<string, number> = {};
  const applicationStats: Record<string, PgConcurrencyApplicationSummary> = {};
  const methodPidGroups = new Map<string, Set<number>>();
  const workerPidGroups = new Map<string, Set<number>>();
  let isStopped = false;
  let polling = false;

  const truncateQuery = (text: string | null | undefined): string | null => {
    if (typeof text !== 'string' || text.length === 0) {
      return text ?? null;
    }
    return text.length > MAX_QUERY_TEXT ? `${text.slice(0, MAX_QUERY_TEXT)}…` : text;
  };

  const recordPoll = async (): Promise<void> => {
    if (polling) {
      return;
    }
    polling = true;
    try {
      const { rows } = await pool.query<{
        pid: number;
        usename: string;
        application_name: string | null;
        state: string | null;
        wait_event_type: string | null;
        wait_event: string | null;
        query_start: Date | null;
        xact_start: Date | null;
        query: string | null;
      }>(PG_STAT_QUERY);
      const processedRows: PgConcurrencyRow[] = rows.map((row) => ({
        pid: row.pid,
        usename: row.usename,
        applicationName: row.application_name,
        state: row.state,
        waitEventType: row.wait_event_type,
        waitEvent: row.wait_event,
        queryStart: row.query_start ? row.query_start.toISOString() : null,
        xactStart: row.xact_start ? row.xact_start.toISOString() : null,
        query: truncateQuery(row.query),
      }));
      const finalAppName = (row: PgConcurrencyRow) =>
        row.applicationName === null || row.applicationName.length === 0
          ? 'unnamed'
          : resolveMethodKey(row.applicationName);
      const totalSessions = processedRows.length;
      const activeSessions = processedRows.filter((row) => row.state === 'active').length;
      const activeExecutingSessions = processedRows.filter(
        (row) => row.state === 'active' && row.waitEventType !== 'Lock',
      ).length;
      const lockWaitingSessions = processedRows.filter(
        (row) => row.state === 'active' && row.waitEventType === 'Lock',
      ).length;
      const appCounts: Record<string, { total: number; active: number; activeExecuting: number }> = {};
      processedRows.forEach((row) => {
        const key = finalAppName(row);
        const entry = appCounts[key] ?? { total: 0, active: 0, activeExecuting: 0 };
        entry.total += 1;
        if (row.state === 'active') {
          entry.active += 1;
          if (row.waitEventType !== 'Lock') {
            entry.activeExecuting += 1;
          }
        }
        appCounts[key] = entry;

        const methodKey = resolveMethodKey(row.applicationName);
        const methodSet = methodPidGroups.get(methodKey) ?? new Set<number>();
        methodSet.add(row.pid);
        methodPidGroups.set(methodKey, methodSet);

        const workerTag = resolveWorkerTag(row.applicationName);
        const workerSet = workerPidGroups.get(workerTag) ?? new Set<number>();
        workerSet.add(row.pid);
        workerPidGroups.set(workerTag, workerSet);
      });
      const waitTypeCounts: Record<string, number> = {};
      processedRows.forEach((row) => {
        const key = row.waitEventType ?? 'none';
        waitTypeCounts[key] = (waitTypeCounts[key] ?? 0) + 1;
        waitEventTotals[key] = (waitEventTotals[key] ?? 0) + 1;
      });
      totalPolls += 1;
      maxTotalSessions = Math.max(maxTotalSessions, totalSessions);
      maxActiveSessions = Math.max(maxActiveSessions, activeSessions);
      maxActiveExecutingSessions = Math.max(maxActiveExecutingSessions, activeExecutingSessions);
      maxLockWaitSessions = Math.max(maxLockWaitSessions, lockWaitingSessions);
      Object.entries(appCounts).forEach(([app, counts]) => {
        const stats = applicationStats[app] ?? {
          maxConcurrentSessions: 0,
          maxActiveSessions: 0,
          maxActiveExecutingSessions: 0,
          sampleCount: 0,
        };
        stats.maxConcurrentSessions = Math.max(stats.maxConcurrentSessions, counts.total);
        stats.maxActiveSessions = Math.max(stats.maxActiveSessions, counts.active);
        stats.maxActiveExecutingSessions = Math.max(
          stats.maxActiveExecutingSessions,
          counts.activeExecuting,
        );
        stats.sampleCount += 1;
        applicationStats[app] = stats;
      });
      timeline.push({
        timestamp: new Date().toISOString(),
        totalSessions,
        activeSessions,
        activeExecutingSessions,
        lockWaitingSessions,
        waitTypeCounts,
        rows: processedRows,
      });
    } catch (error) {
      // Ignore polling failures to avoid interrupting the benchmark.
    } finally {
      polling = false;
    }
  };

  const toPidCounts = (groups: Map<string, Set<number>>): Record<string, number> => {
    const counts: Record<string, number> = {};
    groups.forEach((set, key) => {
      counts[key] = set.size;
    });
    return counts;
  };

  const intervalHandle = setInterval(() => {
    void recordPoll();
  }, intervalMs);

  await recordPoll();

  const stop = async (): Promise<PgConcurrencySummary> => {
    const jsonPath = path.join(options.outputDir, 'pg-concurrency.json');
    const mdPath = path.join(options.outputDir, 'pg-concurrency.md');
    if (isStopped) {
      const methodCounts = toPidCounts(methodPidGroups);
      const workerTagCounts = toPidCounts(workerPidGroups);
      return {
        jsonPath,
        mdPath,
        maxTotalSessions,
        maxActiveSessions,
        maxActiveExecutingSessions,
        maxLockWaitSessions,
        totalPolls,
        waitEventTotals,
        timelineSample: timeline.slice(-5),
        byApplication: applicationStats,
        distinctBackendPidsByMethod: methodCounts,
        distinctBackendPidsByWorkerTag: workerTagCounts,
      };
    }
    clearInterval(intervalHandle);
    await recordPoll();
    await pool.end();
    isStopped = true;
    const methodCounts = toPidCounts(methodPidGroups);
    const workerTagCounts = toPidCounts(workerPidGroups);
    const payload = {
      summary: {
        maxTotalSessions,
        maxActiveSessions,
        maxActiveExecutingSessions,
        maxLockWaitSessions,
        totalPolls,
        waitEventTotals,
        distinctBackendPidsByMethod: methodCounts,
        distinctBackendPidsByWorkerTag: workerTagCounts,
      },
      timeline,
      byApplication: applicationStats,
    };
    await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

    const mdLines: string[] = [];
    mdLines.push('# PostgreSQL concurrency summary');
    mdLines.push('');
    mdLines.push(`- Max total sessions: ${maxTotalSessions}`);
    mdLines.push(`- Max sessions with state='active': ${maxActiveSessions}`);
    mdLines.push(`- Max active executing sessions: ${maxActiveExecutingSessions}`);
    mdLines.push(`- Max lock-waiting sessions: ${maxLockWaitSessions}`);
    mdLines.push(`- Polls sampled: ${totalPolls}`);
    mdLines.push('');
    mdLines.push('## Wait event type distribution');
    mdLines.push('');
    mdLines.push('| wait_event_type | count |');
    mdLines.push('| --- | ---: |');
    for (const [key, count] of Object.entries(waitEventTotals)) {
      mdLines.push(`| ${key} | ${count} |`);
    }
    mdLines.push('');
    if (Object.keys(applicationStats).length > 0) {
      mdLines.push('## Sessions by application name');
      mdLines.push('');
      mdLines.push(
        '| application_name | max concurrent | max active | max active executing | samples |',
      );
      mdLines.push('| --- | ---: | ---: | ---: | ---: |');
      for (const [app, stats] of Object.entries(applicationStats)) {
        mdLines.push(
          `| ${app} | ${stats.maxConcurrentSessions} | ${stats.maxActiveSessions} | ${stats.maxActiveExecutingSessions} | ${stats.sampleCount} |`,
        );
      }
      mdLines.push('');
    }
    if (Object.keys(methodCounts).length > 0) {
      mdLines.push('## Distinct backend PIDs by method');
      mdLines.push('');
      mdLines.push('| method | distinct backend PIDs |');
      mdLines.push('| --- | ---: |');
      for (const [method, count] of Object.entries(methodCounts)) {
        mdLines.push(`| ${method} | ${count} |`);
      }
      mdLines.push('');
    }
    if (Object.keys(workerTagCounts).length > 0) {
      mdLines.push('## Distinct backend PIDs by worker tag');
      mdLines.push('');
      mdLines.push('| worker tag | distinct backend PIDs |');
      mdLines.push('| --- | ---: |');
      for (const [tag, count] of Object.entries(workerTagCounts)) {
        mdLines.push(`| ${tag} | ${count} |`);
      }
      mdLines.push('');
    }
    mdLines.push('## Timeline sample (last 5 polls)');
    mdLines.push('');
    mdLines.push(
      '| time | total sessions | active sessions | active executing | lock waiting | wait_event_type counts |',
    );
    mdLines.push('| --- | ---: | ---: | ---: | ---: | --- |');
    timeline.slice(-5).forEach((entry) => {
      const waitText = Object.entries(entry.waitTypeCounts)
        .map(([type, count]) => `${type}=${count}`)
        .join(', ');
      mdLines.push(
        `| ${entry.timestamp} | ${entry.totalSessions} | ${entry.activeSessions} | ${entry.activeExecutingSessions} | ${entry.lockWaitingSessions} | ${waitText} |`,
      );
    });
    await fs.writeFile(mdPath, mdLines.join('\n') + '\n', 'utf8');

    return {
      jsonPath,
      mdPath,
      maxTotalSessions,
      maxActiveSessions,
      maxActiveExecutingSessions,
      maxLockWaitSessions,
      totalPolls,
      waitEventTotals,
      timelineSample: timeline.slice(-5),
      byApplication: applicationStats,
      distinctBackendPidsByMethod: methodCounts,
      distinctBackendPidsByWorkerTag: workerTagCounts,
    };
  };

  return { stop };
}

export async function loadPgConcurrencySummaryFromDisk(
  outputDir: string,
): Promise<PgConcurrencySummary> {
  const jsonPath = path.join(outputDir, 'pg-concurrency.json');
  const mdPath = path.join(outputDir, 'pg-concurrency.md');
  const raw = await fs.readFile(jsonPath, 'utf8');
  const parsed = JSON.parse(raw) as {
    summary: {
      maxTotalSessions: number;
      maxActiveSessions: number;
      maxActiveExecutingSessions: number;
      maxLockWaitSessions: number;
      totalPolls: number;
      waitEventTotals: Record<string, number>;
      distinctBackendPidsByMethod: Record<string, number>;
      distinctBackendPidsByWorkerTag: Record<string, number>;
    };
    timeline: PgConcurrencyTimelineEntry[];
    byApplication: Record<string, PgConcurrencyApplicationSummary>;
  };

  return {
    jsonPath,
    mdPath,
    maxTotalSessions: parsed.summary.maxTotalSessions,
    maxActiveSessions: parsed.summary.maxActiveSessions,
    maxActiveExecutingSessions: parsed.summary.maxActiveExecutingSessions,
    maxLockWaitSessions: parsed.summary.maxLockWaitSessions,
    totalPolls: parsed.summary.totalPolls,
    waitEventTotals: parsed.summary.waitEventTotals,
    timelineSample: parsed.timeline.slice(-5),
    byApplication: parsed.byApplication ?? {},
    distinctBackendPidsByMethod: parsed.summary.distinctBackendPidsByMethod,
    distinctBackendPidsByWorkerTag: parsed.summary.distinctBackendPidsByWorkerTag,
  };
}
