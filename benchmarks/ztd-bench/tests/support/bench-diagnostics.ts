import type { RunPhase } from './diagnostics';
import type { ConnectionModel, ModeLabel } from './diagnostics';

type DiagnosticKeyParams = {
  scenario: string;
  connectionModel: ConnectionModel;
  mode: ModeLabel;
  phase: RunPhase;
  suiteMultiplier: number;
  workerCount: number;
};

function buildDiagnosticKey(params: DiagnosticKeyParams): string {
  return `${params.scenario}|${params.connectionModel}|${params.mode}|${params.phase}|${params.suiteMultiplier}|${params.workerCount}`;
}

const ztdWaitingMap = new Map<string, number[]>();
const ztdSessionMap = new Map<string, number[]>();

export function recordZtdWaiting(params: DiagnosticKeyParams, waitingMs: number): void {
  const key = buildDiagnosticKey(params);
  const entry = ztdWaitingMap.get(key) ?? [];
  entry.push(waitingMs);
  ztdWaitingMap.set(key, entry);
}

export function recordZtdSession(params: DiagnosticKeyParams, maxActive: number): void {
  const key = buildDiagnosticKey(params);
  const entry = ztdSessionMap.get(key) ?? [];
  entry.push(maxActive);
  ztdSessionMap.set(key, entry);
}

export function getZtdWaitingMap(): Map<string, number[]> {
  return ztdWaitingMap;
}

export function getZtdSessionMap(): Map<string, number[]> {
  return ztdSessionMap;
}

export function clearZtdDiagnostics(): void {
  ztdWaitingMap.clear();
  ztdSessionMap.clear();
}
