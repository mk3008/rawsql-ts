import type { ConnectionModel, DbConcurrencyMode } from '../../ztd-bench/tests/support/diagnostics';
import type { BenchProfile, BenchScenarioSelection } from '../types';

export const DEFAULT_CONNECTION_MODEL: ConnectionModel = 'perWorker';
export const DEFAULT_CONNECTION_MODELS: ConnectionModel[] = ['perWorker', 'caseLocal'];
const CONNECTION_MODEL_ALIASES: Record<string, ConnectionModel> = {
  perworker: 'perWorker',
  caselocal: 'caseLocal',
  shared: 'perWorker',
};

export function resolveDbConcurrencyMode(): DbConcurrencyMode {
  const raw = process.env.ZTD_DB_CONCURRENCY?.trim().toLowerCase();
  if (raw === 'perworker' || raw === 'per_worker' || raw === 'per-worker') {
    return 'perWorker';
  }
  if (raw === 'single') {
    return 'single';
  }
  return 'single';
}

function normalizeConnectionModelKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/gu, '');
}

export function parseConnectionModelToken(value: string, source: string): ConnectionModel {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Empty connection model provided in ${source}`);
  }
  const normalized = normalizeConnectionModelKey(trimmed);
  const resolved = CONNECTION_MODEL_ALIASES[normalized];
  if (!resolved) {
    throw new Error(
      `Invalid connection model "${value}" for ${source}. Supported values: perWorker and caseLocal (aliases: shared, case-local, per-worker).`,
    );
  }
  return resolved;
}

function resolveLegacyConnectionModel(envVar: string): ConnectionModel | undefined {
  const value = process.env[envVar];
  if (!value) {
    return undefined;
  }
  return parseConnectionModelToken(value, envVar);
}

export function resolveBenchConnectionModels(): ConnectionModel[] {
  const explicitSingle = process.env.BENCH_CONNECTION_MODEL
    ? parseConnectionModelToken(process.env.BENCH_CONNECTION_MODEL, 'BENCH_CONNECTION_MODEL')
    : undefined;
  const legacyZtd = resolveLegacyConnectionModel('ZTD_BENCH_CONNECTION_MODEL');
  const legacyTraditional = resolveLegacyConnectionModel('TRADITIONAL_BENCH_CONNECTION_MODEL');

  if (legacyZtd && legacyTraditional && legacyZtd !== legacyTraditional) {
    throw new Error(
      'ZTD_BENCH_CONNECTION_MODEL and TRADITIONAL_BENCH_CONNECTION_MODEL must agree; remove the legacy variables or ensure they match.',
    );
  }

  // Legacy variables must agree and can still seed the default connection model.
  const legacyModel = legacyZtd ?? legacyTraditional;
  if (explicitSingle && legacyModel && explicitSingle !== legacyModel) {
    throw new Error(
      'BENCH_CONNECTION_MODEL must match the legacy ZTD_BENCH_CONNECTION_MODEL/TRADITIONAL_BENCH_CONNECTION_MODEL values when supplied.',
    );
  }

  const multiRaw = process.env.BENCH_CONNECTION_MODELS;
  if (multiRaw && multiRaw.trim().length > 0) {
    // Multi-run mode enumerates each connection model we want to exercise sequentially.
    const tokens = multiRaw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const resolvedModels: ConnectionModel[] = [];
    const seen = new Set<ConnectionModel>();
    for (const token of tokens) {
      const model = parseConnectionModelToken(token, 'BENCH_CONNECTION_MODELS');
      if (!seen.has(model)) {
        resolvedModels.push(model);
        seen.add(model);
      }
    }
    if (resolvedModels.length === 0) {
      throw new Error('BENCH_CONNECTION_MODELS must include at least one connection model.');
    }
    if (explicitSingle && explicitSingle !== resolvedModels[0]) {
      throw new Error('BENCH_CONNECTION_MODEL must match the first entry of BENCH_CONNECTION_MODELS.');
    }
    if (legacyModel && !resolvedModels.includes(legacyModel)) {
      throw new Error(
        'Legacy connection model must appear in BENCH_CONNECTION_MODELS when legacy variables are set.',
      );
    }
    return resolvedModels;
  }

  const baseModel = explicitSingle ?? legacyModel;
  if (baseModel) {
    return [baseModel];
  }
  return DEFAULT_CONNECTION_MODELS;
}

export function resolveBenchProfile(): BenchProfile {
  const raw = (process.env.BENCH_PROFILE ?? 'quick').toLowerCase().trim();
  if (raw === 'ci' || raw === 'full') {
    return {
      name: 'ci',
      defaults: {
        warmupRuns: 2,
        measuredRuns: 10,
        suiteMultipliers: [10, 20, 40, 80],
        steadyStateIterations: 10,
        steadyStateSuiteMultiplier: 50,
      },
    };
  }
  if (raw === 'dev') {
    return {
      name: 'dev',
      defaults: {
        warmupRuns: 1,
        measuredRuns: 10,
        suiteMultipliers: [10, 20, 40, 80],
        steadyStateIterations: 5,
        steadyStateSuiteMultiplier: 10,
      },
    };
  }
  return {
    name: 'quick',
    defaults: {
      warmupRuns: 1,
      measuredRuns: 5,
      suiteMultipliers: [10, 20, 40, 80],
      steadyStateIterations: 3,
      steadyStateSuiteMultiplier: 10,
    },
  };
}

export function resolveBenchScenarios(defaultSelection: BenchScenarioSelection): BenchScenarioSelection {
  const raw = process.env.BENCH_SCENARIOS?.toLowerCase().trim();
  if (raw === 'runner') {
    return {
      label: 'runner',
      includeRunner: true,
      includeSteady: false,
      includeLowerBound: false,
    };
  }
  if (raw === 'steady') {
    return {
      label: 'steady',
      includeRunner: false,
      includeSteady: true,
      includeLowerBound: false,
    };
  }
  if (raw === 'all') {
    return {
      label: 'all',
      includeRunner: true,
      includeSteady: true,
      includeLowerBound: true,
    };
  }

  return defaultSelection;
}

export function resolveNumberSetting(value: string | undefined, fallback: number, min: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function resolveSuiteMultipliers(defaults: number[]): number[] {
  const raw = process.env.SUITE_MULTIPLIERS;
  const values = (raw ?? defaults.join(','))
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));
  // Ensure at least one multiplier so the benchmark always has output.
  return values.length > 0 ? values : defaults.length > 0 ? defaults : [1];
}

export function resolveSteadyStateIterations(defaultValue: number): number {
  const raw = Number(process.env.ITERATIONS ?? defaultValue);
  if (!Number.isFinite(raw) || raw < 1) {
    return defaultValue;
  }
  return Math.floor(raw);
}

function normalizeWorkerCounts(raw: string): number[] {
  return raw
    .split(',')
    .map((entry) => Number(entry.trim()))
    .map((value) => Math.floor(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce<number[]>((acc, value) => {
      if (!acc.includes(value)) {
        acc.push(value);
      }
      return acc;
    }, []);
}

export function resolveParallelWorkerCounts(diagnosticMode: boolean): number[] {
  if (diagnosticMode) {
    return [1];
  }
  const explicitList = process.env.BENCH_PARALLEL_WORKER_COUNTS;
  if (explicitList && explicitList.trim().length > 0) {
    const parsed = normalizeWorkerCounts(explicitList);
    if (parsed.length > 0) {
      return parsed;
    }
  }
  const legacyWorkers = Number(process.env.ZTD_BENCH_WORKERS ?? '');
  if (Number.isFinite(legacyWorkers) && legacyWorkers > 0) {
    return [Math.floor(legacyWorkers)];
  }
  return [4, 8];
}

export function resolveTraditionalDbSerialLockKey(): number {
  const raw = Number(process.env.TRADITIONAL_DB_SERIAL_LOCK_KEY);
  if (Number.isFinite(raw) && raw >= 0) {
    return Math.max(1, Math.floor(raw));
  }
  return 0xdea10fd;
}
