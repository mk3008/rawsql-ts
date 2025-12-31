import fs from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';
import type { ConnectionModel, DbConcurrencyMode } from '../ztd-bench-vs-raw/tests/support/diagnostics';

export type BenchContext = {
  scenario?: string;
  mode?: string;
  phase?: string;
  suiteMultiplier?: number;
  runIndex?: number;
  caseName?: string;
  workerId?: string;
  approach?: string;
  note?: string;
  connectionModel?: ConnectionModel;
  dbConcurrencyMode?: DbConcurrencyMode;
  parallelWorkerCount?: number;
};

export type BenchPhaseLogEntry = {
  type?: string;
  phase?: string;
  status?: 'start' | 'end';
  context?: BenchContext;
  waitingMs?: number;
  durationMs?: number;
  cleanupMs?: number;
};

const benchPhaseEntries: BenchPhaseLogEntry[] = [];

export function recordBenchPhaseEntry(entry: BenchPhaseLogEntry): void {
  benchPhaseEntries.push(entry);
}

export function getBenchPhaseEntries(): BenchPhaseLogEntry[] {
  return [...benchPhaseEntries];
}

export function clearBenchPhaseEntries(): void {
  benchPhaseEntries.length = 0;
}

type BenchLogLevel = 'quiet' | 'info' | 'debug';

const LOG_LEVEL_PRIORITY: Record<BenchLogLevel, number> = {
  quiet: 0,
  info: 1,
  debug: 2,
};

let configuredLevel: BenchLogLevel = 'quiet';
let configuredLogPath = path.join(process.cwd(), 'tmp', 'bench', 'log.jsonl');
let logStream: fs.WriteStream | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function parseLogLevel(raw?: string | BenchLogLevel): BenchLogLevel {
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : undefined;
  if (normalized === 'debug') {
    return 'debug';
  }
  if (normalized === 'info' || normalized === 'verbose') {
    return 'info';
  }
  return 'quiet';
}

function ensureLogStream(): fs.WriteStream {
  if (logStream) {
    return logStream;
  }
  // Ensure the log directory exists before creating the append stream.
  fs.mkdirSync(path.dirname(configuredLogPath), { recursive: true });
  logStream = fs.createWriteStream(configuredLogPath, { flags: 'a' });
  return logStream;
}

function shouldLogToConsole(level: BenchLogLevel): boolean {
  return LOG_LEVEL_PRIORITY[configuredLevel] >= LOG_LEVEL_PRIORITY[level];
}

function writeLog(event: Record<string, unknown>, consoleLevel: BenchLogLevel): void {
  const payload = {
    ts: nowIso(),
    ...event,
  };
  const json = JSON.stringify(payload);
  ensureLogStream().write(`${json}\n`);
  if (shouldLogToConsole(consoleLevel)) {
    console.log(json);
  }
}

export function configureBenchmarkLogger(options?: {
  level?: string;
  logFilePath?: string;
}): void {
  // Apply the requested log level and log file path before emitting events.
  const requestedLevel =
    options?.level ?? process.env.BENCH_LOG_LEVEL ?? configuredLevel;
  configuredLevel = parseLogLevel(requestedLevel);
  if (options?.logFilePath) {
    configuredLogPath = options.logFilePath;
  }
  if (logStream) {
    logStream.end();
    logStream = null;
  }
  clearBenchPhaseEntries();
}

export function resetBenchmarkLog(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
  // Truncate the log so each benchmark run starts with a clean file.
  fs.mkdirSync(path.dirname(configuredLogPath), { recursive: true });
  fs.writeFileSync(configuredLogPath, '', 'utf8');
  clearBenchPhaseEntries();
}

export function closeBenchmarkLogger(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
  clearBenchPhaseEntries();
}

function log(event: Record<string, unknown>, level: BenchLogLevel): void {
  // Route every event through the shared writer so console mirroring stays consistent.
  writeLog(event, level);
}

export function logBenchPhase(
  phase: string,
  status: 'start' | 'end',
  context: BenchContext,
  extra?: Record<string, unknown>,
): void {
  const entry: BenchPhaseLogEntry = {
    type: 'bench-phase',
    phase,
    status,
    context,
    ...extra,
  };
  recordBenchPhaseEntry(entry);
  log(
    {
      type: 'bench-phase',
      phase,
      status,
      context,
      ...extra,
    },
    'info',
  );
}

export function logBenchProgress(
  message: string,
  context: BenchContext,
  extra?: Record<string, unknown>,
): void {
  log(
    {
      type: 'bench-progress',
      message,
      context,
      ...extra,
    },
    'info',
  );
}

export function logBenchDebug(event: Record<string, unknown>): void {
  log(
    {
      type: 'bench-debug',
      ...event,
    },
    'debug',
  );
}

export function logPoolStats(pool: Pool, context: BenchContext, note: string): void {
  log(
    {
      type: 'bench-pool',
      note,
      stats: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
      context,
    },
    'debug',
  );
}
