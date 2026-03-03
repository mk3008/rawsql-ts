import type { Row } from './mapper'

export type QueryExecutionResult =
  | Row[]
  | {
      rows: Row[]
      rowCount?: number
    }

export type NormalizedExecutionResult = {
  rows: Row[]
  rowCount?: number
}

export function normalizeExecutionResult(
  value: QueryExecutionResult
): NormalizedExecutionResult {
  if (Array.isArray(value)) {
    return { rows: value }
  }

  if (value && typeof value === 'object' && 'rows' in value) {
    return {
      rows: value.rows,
      rowCount: value.rowCount,
    }
  }

  return { rows: [] }
}
