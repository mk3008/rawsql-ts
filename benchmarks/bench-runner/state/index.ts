import type { ConnectionModel } from '../../ztd-bench/tests/support/diagnostics';
import { DEFAULT_CONNECTION_MODEL } from '../config';
import type {
  ExecutionMode,
  TraditionalParallelDiagnostic,
  WorkerActivity,
  WorkerTimeRange,
} from '../types';

const workerActivities = new Map<string, WorkerActivity>();

let currentTraditionalDiagnostic: TraditionalParallelDiagnostic | null = null;
export const parallelValidationTokens = new Set<string>();

function normalizeWorkerId(workerId?: string): string {
  return workerId && workerId.length > 0 ? workerId : 'unknown';
}

function buildWorkerActivityKey(
  connectionModel: ConnectionModel,
  scenarioLabel: string,
  mode: ExecutionMode,
  workerId: string,
): string {
  return `${connectionModel}|${scenarioLabel}|${mode}|${workerId}`;
}

function getOrCreateWorkerActivity(
  connectionModel: ConnectionModel,
  scenarioLabel: string,
  mode: ExecutionMode,
  workerId: string,
): WorkerActivity {
  const normalizedWorker = normalizeWorkerId(workerId);
  const key = buildWorkerActivityKey(connectionModel, scenarioLabel, mode, normalizedWorker);
  let activity = workerActivities.get(key);
  if (!activity) {
    activity = {
      connectionModel,
      scenarioLabel,
      mode,
      workerId: normalizedWorker,
      cases: 0,
      migrationStatements: 0,
    };
    workerActivities.set(key, activity);
  }
  return activity;
}

export function recordWorkerCaseStart(
  connectionModel: ConnectionModel,
  scenarioLabel: string,
  mode: ExecutionMode,
  workerId?: string,
): void {
  const activity = getOrCreateWorkerActivity(connectionModel, scenarioLabel, mode, workerId ?? 'unknown');
  const startedAt = Date.now();
  if (activity.startMs === undefined || startedAt < activity.startMs) {
    activity.startMs = startedAt;
  }
}

export function recordWorkerCaseCompletion(
  connectionModel: ConnectionModel,
  scenarioLabel: string,
  mode: ExecutionMode,
  workerId?: string,
): void {
  const activity = getOrCreateWorkerActivity(connectionModel, scenarioLabel, mode, workerId ?? 'unknown');
  const completedAt = Date.now();
  activity.endMs = activity.endMs === undefined ? completedAt : Math.max(activity.endMs, completedAt);
  activity.cases += 1;
}

export function recordWorkerMigrationStatements(
  connectionModel: ConnectionModel,
  scenarioLabel: string,
  mode: ExecutionMode,
  workerId: string | undefined,
  count: number,
): void {
  if (count <= 0) {
    return;
  }
  const activity = getOrCreateWorkerActivity(connectionModel, scenarioLabel, mode, workerId ?? 'unknown');
  activity.migrationStatements += count;
}

export function getWorkerActivities(): WorkerActivity[] {
  return Array.from(workerActivities.values());
}

export function captureAndResetWorkerTimeRanges(runStartMs: number): WorkerTimeRange[] {
  const ranges = getWorkerActivities().map((activity) => ({
    workerId: activity.workerId,
    cases: activity.cases,
    startOffsetMs:
      activity.startMs !== undefined ? activity.startMs - runStartMs : undefined,
    endOffsetMs: activity.endMs !== undefined ? activity.endMs - runStartMs : undefined,
  }));
  workerActivities.clear();
  return ranges.sort((a, b) => a.workerId.localeCompare(b.workerId));
}

export function clearWorkerActivities(): void {
  workerActivities.clear();
}

let currentConnectionModel: ConnectionModel = DEFAULT_CONNECTION_MODEL;

export function setActiveConnectionModel(model: ConnectionModel): void {
  currentConnectionModel = model;
}

export function getActiveConnectionModel(): ConnectionModel {
  return currentConnectionModel;
}

let activeParallelWorkers = 1;

export function setActiveParallelWorkers(count: number): void {
  activeParallelWorkers = count;
}

export function getActiveParallelWorkers(): number {
  return activeParallelWorkers;
}

export function setCurrentTraditionalDiagnostic(
  diagnostic: TraditionalParallelDiagnostic | null,
): void {
  currentTraditionalDiagnostic = diagnostic;
}

export function getCurrentTraditionalDiagnostic(): TraditionalParallelDiagnostic | null {
  return currentTraditionalDiagnostic;
}

export function clearCurrentTraditionalDiagnostic(): void {
  currentTraditionalDiagnostic = null;
}
