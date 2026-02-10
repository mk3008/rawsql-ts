import { existsSync } from 'node:fs';
import { collectTextFiles, readUtf8File } from '../lib/fs';
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

const REQUIRED_TRACE_FIELDS = ['query_id', 'phase', 'duration_ms', 'row_count', 'param_shape', 'error_summary', 'source'];

function parseTraceEvents(raw: string): TraceEvent[] {
  const events: TraceEvent[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      events.push(JSON.parse(trimmed) as TraceEvent);
    } catch {
      // Keep malformed lines out and let required checks fail later.
    }
  }
  return events;
}

function hasAllTraceFields(event: TraceEvent): boolean {
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

export async function runCatalogTraceQualityCheck(workspacePath: string, traceFilePath: string): Promise<CheckResult> {
  const files = await collectTextFiles(workspacePath);
  const runtimeFiles = files.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return normalized.includes('/src/catalog/runtime/') && normalized.endsWith('.ts');
  });

  const violations: string[] = [];
  let runtimeFieldCoverage = false;
  for (const filePath of runtimeFiles) {
    const source = await readUtf8File(filePath);
    if (REQUIRED_TRACE_FIELDS.every((field) => source.includes(field))) {
      runtimeFieldCoverage = true;
      break;
    }
  }
  if (!runtimeFieldCoverage) {
    violations.push('Not observed: runtime code containing all required trace fields.');
  }

  let totalEvents = 0;
  let invalidEvents = 0;
  if (!existsSync(traceFilePath)) {
    violations.push(`Trace file not found: ${traceFilePath}`);
  } else {
    const raw = await readUtf8File(traceFilePath);
    const events = parseTraceEvents(raw);
    totalEvents = events.length;
    invalidEvents = events.filter((event) => !hasAllTraceFields(event)).length;
    if (events.length === 0) {
      violations.push('Not observed: trace events for catalog query execution.');
    }
    if (invalidEvents > 0) {
      violations.push(`Trace events missing required fields: ${invalidEvents}`);
    }
  }

  return {
    name: 'catalog_trace_quality',
    passed: violations.length === 0,
    violations: violations.length,
    details: violations.slice(0, 50),
    meta: {
      runtimeFilesScanned: runtimeFiles.length,
      traceFile: traceFilePath,
      totalEvents,
      invalidEvents
    }
  };
}
