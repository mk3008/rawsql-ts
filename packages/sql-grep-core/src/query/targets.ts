import type { QueryUsageMode, QueryUsageTarget, QueryUsageTargetKind } from './types';

export interface ParsedQueryTarget {
  mode: QueryUsageMode;
  target: QueryUsageTarget;
}

/**
 * Parse strict-first query targets and reject implicit broadening.
 */
export function parseQueryTarget(params: {
  kind: QueryUsageTargetKind;
  raw: string;
  anySchema?: boolean;
  anyTable?: boolean;
}): ParsedQueryTarget {
  const raw = params.raw.trim();
  if (!raw) {
    throw new Error(`Target must be a non-empty ${params.kind} selector.`);
  }
  if (params.anyTable && !params.anySchema) {
    throw new Error('--any-table requires --any-schema.');
  }

  const parts = raw.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (params.kind === 'table') {
    return parseTableTarget(parts, raw, Boolean(params.anySchema), Boolean(params.anyTable));
  }
  return parseColumnTarget(parts, raw, Boolean(params.anySchema), Boolean(params.anyTable));
}

function parseTableTarget(parts: string[], raw: string, anySchema: boolean, anyTable: boolean): ParsedQueryTarget {
  if (anyTable) {
    throw new Error('--any-table is not supported for table usage.');
  }
  if (parts.length === 2) {
    return {
      mode: 'exact',
      target: {
        kind: 'table',
        raw,
        schema: parts[0],
        table: parts[1]
      }
    };
  }
  if (parts.length === 1 && anySchema) {
    return {
      mode: 'any-schema',
      target: {
        kind: 'table',
        raw,
        table: parts[0]
      }
    };
  }
  throw new Error('Table usage requires <schema.table> unless --any-schema is explicitly provided.');
}

function parseColumnTarget(parts: string[], raw: string, anySchema: boolean, anyTable: boolean): ParsedQueryTarget {
  if (parts.length === 3) {
    return {
      mode: 'exact',
      target: {
        kind: 'column',
        raw,
        schema: parts[0],
        table: parts[1],
        column: parts[2]
      }
    };
  }
  if (parts.length === 2 && anySchema && !anyTable) {
    return {
      mode: 'any-schema',
      target: {
        kind: 'column',
        raw,
        table: parts[0],
        column: parts[1]
      }
    };
  }
  if (parts.length === 1 && anySchema && anyTable) {
    return {
      mode: 'any-schema-any-table',
      target: {
        kind: 'column',
        raw,
        column: parts[0]
      }
    };
  }
  throw new Error(
    'Column usage requires <schema.table.column> by default. Use --any-schema for <table.column> or --any-schema --any-table for <column>.'
  );
}
