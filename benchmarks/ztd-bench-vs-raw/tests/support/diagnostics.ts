export type ConnectionModel = 'perWorker' | 'caseLocal';
export type ModeLabel = 'serial' | 'parallel';
export type RunPhase = 'warmup' | 'measured';
export type DbConcurrencyMode = 'single' | 'perWorker';

export type ConnectionLoggerEntry = {
  scenarioLabel: string;
  mode: ModeLabel;
  phase: RunPhase;
  suiteMultiplier: number;
  runIndex: number;
  workerCount?: number;
  workerId?: string;
  caseName?: string;
  pid: number;
  connectionModel: ConnectionModel;
  applicationName?: string;
  dbConcurrencyMode?: DbConcurrencyMode;
  traditionalDbSerialLock?: boolean;
};

export type ConnectionLogger = (entry: ConnectionLoggerEntry) => void;

const connectionEvents: ConnectionLoggerEntry[] = [];

export function recordConnectionEvent(entry: ConnectionLoggerEntry): void {
  connectionEvents.push(entry);
}

export function getConnectionEvents(): ConnectionLoggerEntry[] {
  return [...connectionEvents];
}

export function appendConnectionEvents(entries: ConnectionLoggerEntry[]): void {
  connectionEvents.push(...entries);
}

export function clearConnectionEvents(): void {
  connectionEvents.length = 0;
}

export type SessionStat = {
  scenarioLabel: string;
  mode: ModeLabel;
  phase: RunPhase;
  suiteMultiplier: number;
  runIndex: number;
  workerCount: number;
  dbConcurrencyMode?: DbConcurrencyMode;
  maxTotalSessions: number;
  maxActiveExecutingSessions: number;
  maxLockWaitSessions: number;
  sampleCount: number;
};

const sessionStats: SessionStat[] = [];

export function recordSessionStat(stat: SessionStat): void {
  sessionStats.push(stat);
}

export function getSessionStats(): SessionStat[] {
  return [...sessionStats];
}

export function clearSessionStats(): void {
  sessionStats.length = 0;
}

export function appendSessionStats(stats: SessionStat[]): void {
  sessionStats.push(...stats);
}
