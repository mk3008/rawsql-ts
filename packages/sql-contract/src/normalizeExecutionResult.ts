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

function toPreview(value: unknown): string {
  try {
    const serialized = JSON.stringify(value)
    if (serialized) {
      return serialized.length > 180
        ? `${serialized.slice(0, 180)}...`
        : serialized
    }
  } catch {
    // JSON stringify can fail on circular values; fall back to String below.
  }

  const fallback = String(value)
  return fallback.length > 180 ? `${fallback.slice(0, 180)}...` : fallback
}

export function normalizeExecutionResult(
  value: unknown
): NormalizedExecutionResult {
  if (Array.isArray(value)) {
    return { rows: value }
  }

  if (value && typeof value === 'object' && 'rows' in value) {
    const rows = (value as { rows: unknown }).rows
    const rowCount = (value as { rowCount?: unknown }).rowCount

    if (!Array.isArray(rows)) {
      throw new Error(
        `normalizeExecutionResult expected "rows" to be an array, received ${typeof rows}. preview=${toPreview(rows)}`
      )
    }

    if (rowCount !== undefined && typeof rowCount !== 'number') {
      throw new Error(
        `normalizeExecutionResult expected "rowCount" to be a number when present, received ${typeof rowCount}. preview=${toPreview(rowCount)}`
      )
    }

    return {
      rows,
      rowCount,
    }
  }

  throw new Error(
    `normalizeExecutionResult expected an array or { rows, rowCount? } object, received ${typeof value}. preview=${toPreview(value)}`
  )
}
