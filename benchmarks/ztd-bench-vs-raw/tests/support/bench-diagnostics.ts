import type { DbConcurrencyMode, RunPhase } from './diagnostics';
import type { ConnectionModel, ModeLabel } from './diagnostics';

type DiagnosticKeyParams = {
  scenario: string;
  connectionModel: ConnectionModel;
  mode: ModeLabel;
  phase: RunPhase;
  suiteMultiplier: number;
  workerCount: number;
  dbConcurrencyMode?: DbConcurrencyMode;
};

export type ZtdSessionSample = {
  maxActiveExecuting: number;
  maxLockWait: number;
};

function buildDiagnosticKey(params: DiagnosticKeyParams): string {
  const concurrencyMode = params.dbConcurrencyMode ?? 'single';
  return `${params.scenario}|${params.connectionModel}|${params.mode}|${params.phase}|${params.suiteMultiplier}|${params.workerCount}|${concurrencyMode}`;
}

const ztdWaitingMap = new Map<string, number[]>();
const ztdSessionMap = new Map<string, { maxActiveExecuting: number; maxLockWait: number }[]>();

export function recordZtdWaiting(params: DiagnosticKeyParams, waitingMs: number): void {
  const key = buildDiagnosticKey(params);
  const entry = ztdWaitingMap.get(key) ?? [];
  entry.push(waitingMs);
  ztdWaitingMap.set(key, entry);
}

export function recordZtdSession(
  params: DiagnosticKeyParams,
  sample: { maxActiveExecuting: number; maxLockWait: number },
): void {
  const key = buildDiagnosticKey(params);
  const entry = ztdSessionMap.get(key) ?? [];
  entry.push(sample);
  ztdSessionMap.set(key, entry);
}

export function getZtdWaitingMap(): Map<string, number[]> {
  return ztdWaitingMap;
}

export function getZtdSessionMap(): Map<string, { maxActiveExecuting: number; maxLockWait: number }[]> {
  return ztdSessionMap;
}

export function clearZtdDiagnostics(): void {
  ztdWaitingMap.clear();
  ztdSessionMap.clear();
}
