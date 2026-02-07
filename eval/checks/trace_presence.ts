import { existsSync } from 'node:fs';
import { readUtf8File } from '../lib/fs';
import type { CheckResult } from '../lib/report';

interface TraceEvent {
  query_id?: unknown;
  phase?: unknown;
  duration_ms?: unknown;
  row_count?: unknown;
  param_shape?: unknown;
  error_summary?: unknown;
  source?: unknown;
}

export interface TraceMetrics {
  totalEvents: number;
  countsByQueryId: Record<string, number>;
  errorsByQueryId: Record<string, number>;
  slowestQueryIds: Array<{ query_id: string; duration_ms: number }>;
}

function parseTraceLines(raw: string): TraceEvent[] {
  const events: TraceEvent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      events.push(JSON.parse(trimmed) as TraceEvent);
    } catch {
      // Ignore malformed lines and let required-field validation fail.
    }
  }
  return events;
}

function hasRequiredFields(event: TraceEvent): boolean {
  return (
    typeof event.query_id === 'string' &&
    typeof event.phase === 'string' &&
    typeof event.duration_ms === 'number' &&
    typeof event.row_count === 'number' &&
    typeof event.param_shape === 'string' &&
    (typeof event.error_summary === 'string' || event.error_summary === null) &&
    typeof event.source === 'string'
  );
}

function buildMetrics(events: TraceEvent[]): TraceMetrics {
  const countsByQueryId: Record<string, number> = {};
  const errorsByQueryId: Record<string, number> = {};
  const durations: Array<{ query_id: string; duration_ms: number }> = [];

  for (const event of events) {
    if (typeof event.query_id !== 'string') {
      continue;
    }
    countsByQueryId[event.query_id] = (countsByQueryId[event.query_id] ?? 0) + 1;
    if (event.error_summary !== null && event.error_summary !== undefined) {
      errorsByQueryId[event.query_id] = (errorsByQueryId[event.query_id] ?? 0) + 1;
    }
    if (typeof event.duration_ms === 'number') {
      durations.push({ query_id: event.query_id, duration_ms: event.duration_ms });
    }
  }

  durations.sort((a, b) => b.duration_ms - a.duration_ms);
  return {
    totalEvents: events.length,
    countsByQueryId,
    errorsByQueryId,
    slowestQueryIds: durations.slice(0, 5)
  };
}

export async function runTracePresenceCheck(traceFilePath: string): Promise<CheckResult> {
  if (!existsSync(traceFilePath)) {
    return {
      name: 'trace_presence',
      passed: false,
      violations: 1,
      details: [`Trace file not found: ${traceFilePath}`],
      meta: {
        traceFile: traceFilePath,
        totalEvents: 0,
        countsByQueryId: {},
        errorsByQueryId: {},
        slowestQueryIds: []
      }
    };
  }

  const raw = await readUtf8File(traceFilePath);
  const events = parseTraceLines(raw);
  const invalid = events.filter((event) => !hasRequiredFields(event));
  const metrics = buildMetrics(events);

  const details: string[] = [];
  if (events.length === 0) {
    details.push('No trace events found.');
  }
  if (invalid.length > 0) {
    details.push(`Events missing required fields: ${invalid.length}`);
  }
  if (Object.keys(metrics.countsByQueryId).length === 0) {
    details.push('No query_id values found in trace events.');
  }

  return {
    name: 'trace_presence',
    passed: events.length > 0 && invalid.length === 0 && Object.keys(metrics.countsByQueryId).length > 0,
    violations: details.length,
    details,
    meta: {
      traceFile: traceFilePath,
      ...metrics
    }
  };
}
