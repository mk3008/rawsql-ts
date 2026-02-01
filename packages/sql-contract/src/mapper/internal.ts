import type { KeyExtractor, KeyValue, Row } from './index'

type KeyPrimitive = string | number | bigint

function assertPrimitive(component: KeyPrimitive | undefined | null): KeyPrimitive {
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

export function normalizeKeyValue(value: KeyValue): string {
  if (Array.isArray(value)) {
    return normalizeArrayValue(value)
  }
  const primitiveValue = value as KeyPrimitive
  return serializePrimitive(assertPrimitive(primitiveValue))
}

export function normalizeKeyFromRow(
  row: Row,
  key: string | readonly string[] | KeyExtractor<Row>,
  mappingName: string
): string {
  if (typeof key === 'function') {
    return normalizeKeyValue(key(camelCaseRow(row)))
  }

  if (Array.isArray(key)) {
    const columns = key as readonly string[]
    const values = columns.map((column) =>
      assertPrimitive(lookupColumnValue(row, column) as KeyPrimitive)
    )
    return normalizeArrayValue(values)
  }

  const columnKey = key as string
  const component = assertPrimitive(
    lookupColumnValue(row, columnKey) as KeyPrimitive
  )
  return serializePrimitive(component)
}
