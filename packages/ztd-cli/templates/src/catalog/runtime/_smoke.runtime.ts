import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseSmokeOutput, type SmokeOutput } from '../specs/_smoke.spec';
import { normalizeTimestamp } from './_coercions';

export interface CatalogTraceEvent {
  query_id: string;
  phase: 'query.execute';
  duration_ms: number;
  row_count: number;
  param_shape: string;
  error_summary: string | null;
  source: string;
}

export interface CatalogTraceContext {
  query_id: string;
  source: string;
  params?: readonly unknown[] | Record<string, unknown>;
}

export type CatalogTraceObserver = (event: CatalogTraceEvent) => void;

/**
 * Validate runtime output against the catalog smoke invariant.
 */
export function ensureSmokeOutput(value: unknown): SmokeOutput {
  // Normalize driver-dependent timestamp representations before contract validation.
  if (isRecord(value) && 'createdAt' in value) {
    return parseSmokeOutput({
      ...value,
      createdAt: normalizeTimestamp(value.createdAt, 'createdAt')
    });
  }

  return parseSmokeOutput(value);
}

/**
 * Execute a catalog query and emit a normalized trace event.
 */
export async function executeCatalogQueryWithTrace<T>(
  context: CatalogTraceContext,
  execute: () => Promise<readonly T[]>,
  observer?: CatalogTraceObserver
): Promise<readonly T[]> {
  const startedAt = Date.now();
  try {
    const rows = await execute();
    emitTraceEvent(
      {
        query_id: context.query_id,
        phase: 'query.execute',
        duration_ms: Date.now() - startedAt,
        row_count: rows.length,
        param_shape: summarizeParamShape(context.params),
        error_summary: null,
        source: context.source
      },
      observer
    );
    return rows;
  } catch (error) {
    emitTraceEvent(
      {
        query_id: context.query_id,
        phase: 'query.execute',
        duration_ms: Date.now() - startedAt,
        row_count: 0,
        param_shape: summarizeParamShape(context.params),
        error_summary: summarizeError(error),
        source: context.source
      },
      observer
    );
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function summarizeParamShape(value: CatalogTraceContext['params']): string {
  if (value === undefined) {
    return 'none';
  }
  if (Array.isArray(value)) {
    return `array(len=${value.length})`;
  }
  if (!isRecord(value)) {
    return `scalar(${typeof value})`;
  }
  const keys = Object.keys(value).sort();
  return `object(keys=${keys.join(',') || 'none'})`;
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.split(/\r?\n/, 1)[0] ?? error.name;
  }
  return String(error);
}

function emitTraceEvent(event: CatalogTraceEvent, observer?: CatalogTraceObserver): void {
  observer?.(event);

  const traceFile = process.env.ZTD_TRACE_FILE;
  if (!traceFile) {
    return;
  }

  mkdirSync(path.dirname(traceFile), { recursive: true });
  appendFileSync(traceFile, `${JSON.stringify(event)}\n`, 'utf8');
}
