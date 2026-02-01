import type { KeyExtractor, KeyValue, Row } from './index'

type KeyPrimitive = string | number | bigint

function assertPrimitive(component: unknown): KeyPrimitive {
  if (component === undefined || component === null) {
    throw new Error('Internal key component must be defined.')
  }
  if (typeof component === 'string') {
    return component
  }
  if (typeof component === 'number') {
    if (!Number.isFinite(component)) {
      throw new Error('Internal key component must be a finite number.')
    }
    return component
  }
  if (typeof component === 'bigint') {
    return component
  }
  throw new Error('Internal key component must be a string, number, or bigint.')
}

function serializePrimitive(component: KeyPrimitive): string {
  if (typeof component === 'string') {
    return `s:${component.length}:${component}`
  }
  if (typeof component === 'number') {
    return `n:${component}`
  }
  return `b:${component}`
}

function camelCaseRow(row: Row): Row {
  const target: Record<string, unknown> = {}
  for (const column of Object.keys(row)) {
    target[toCamelCase(column)] = row[column]
  }
  return target
}

function toCamelCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((segment, index) =>
      index === 0
        ? segment.toLowerCase()
        : `${segment.charAt(0).toUpperCase()}${segment
            .slice(1)
            .toLowerCase()}`
    )
    .join('')
}

function lookupColumnValue(row: Row, columnName: string): unknown {
  const normalizedKey = columnName.toLowerCase()
  for (const column of Object.keys(row)) {
    if (column.toLowerCase() === normalizedKey) {
      return row[column]
    }
  }
  throw new Error(`Missing key column "${columnName}"`)
}

function normalizeArrayValue(value: readonly KeyPrimitive[]): string {
  if (value.length === 0) {
    throw new Error('Composite key must contain at least one value.')
  }
  return value.map((component) => serializePrimitive(assertPrimitive(component))).join('|')
}

/**
 * Serializes a key value so it can act as a deterministic cache identifier.
 * Array values are flattened, and each component is tagged with its runtime
 * type to keep string/number/bigint collisions distinct (e.g., "1" vs 1).
 *
 * @param value - A primitive or composite key value produced by a mapping.
 * @returns A stable string representation that preserves component order and types.
 * @throws If the provided value is null, undefined, or not a supported primitive.
 */
export function normalizeKeyValue(value: KeyValue): string {
  if (Array.isArray(value)) {
    return normalizeArrayValue(value)
  }
  const primitiveValue = assertPrimitive(value)
  return serializePrimitive(primitiveValue)
}

/**
 * Extracts and normalizes a key from a database row using the supplied descriptor.
 *
 * @param row - The raw database row whose column names may still be snake_case.
 * @param key - A property name, an ordered list of column names (for composites), or a key extractor.
 * @param mappingName - Reserved for error-context messaging when columns are missing.
 * @returns A deterministic string form of the key that preserves component ordering and types.
 * @throws If required columns are missing or contain null/undefined values.
 */
export function normalizeKeyFromRow(
  row: Row,
  key: string | readonly string[] | KeyExtractor<Row>,
  mappingName: string
): string {
  if (typeof key === 'function') {
    return normalizeKeyValue(key(camelCaseRow(row)))
  }

  if (Array.isArray(key)) {
    const values = key.map((column) => assertPrimitive(lookupColumnValue(row, column)))
    return normalizeArrayValue(values)
  }

  const columnKey = key as string
  const component = assertPrimitive(lookupColumnValue(row, columnKey))
  return serializePrimitive(component)
}
