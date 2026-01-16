export type ParamValue =
  | string
  | number
  | boolean
  | null
  | bigint
  | Date
  | Uint8Array

export type RecordValues = Record<string, unknown | undefined>
export type Key = Record<string, unknown>

const ensureEntries = (entries: readonly unknown[], kind: 'insert' | 'update') => {
  if (entries.length === 0) {
    throw new Error(
      kind === 'insert' ? 'insert values must not be empty' : 'update values must not be empty',
    )
  }
}

const formatPlaceholder = (index: number) => `$${index}`

const buildPlaceholders = (count: number, startIndex = 1) =>
  Array.from({ length: count }, (_, index) => formatPlaceholder(startIndex + index))

const buildWhereClause = (key: Key, startIndex: number) => {
  const entries = Object.entries(key)
  if (entries.length === 0) {
    throw new Error('where must not be empty')
  }

  const params = entries.map(([, value]) => {
    if (value === undefined) {
      throw new Error('key values must not be undefined')
    }
    return value
  })

  // Build a flat AND list of equality checks with placeholders offset by the caller.
  const clauses = entries
    .map(([column], index) => `${column} = ${formatPlaceholder(startIndex + index)}`)
    .join(' AND ')

  return {
    clause: `WHERE ${clauses}`,
    params,
  }
}

export const insert = (table: string, values: RecordValues) => {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined)
  ensureEntries(entries, 'insert')

  const columns = entries.map(([column]) => column).join(', ')
  const params = entries.map(([, value]) => value)
  const placeholders = buildPlaceholders(params.length).join(', ')

  return {
    sql: `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
    params,
  }
}

export const update = (table: string, values: RecordValues, where: Key) => {    
  const entries = Object.entries(values).filter(([, value]) => value !== undefined)
  ensureEntries(entries, 'update')

  const params = entries.map(([, value]) => value)
  const clauses = entries
    .map(([column], index) => `${column} = ${formatPlaceholder(index + 1)}`)
    .join(', ')
  // Offset WHERE placeholders so they follow the SET parameters.
  const whereClause = buildWhereClause(where, params.length + 1)

  return {
    sql: `UPDATE ${table} SET ${clauses} ${whereClause.clause}`,
    params: [...params, ...whereClause.params],
  }
}

export const remove = (table: string, where: Key) => {
  const whereClause = buildWhereClause(where, 1)

  return {
    sql: `DELETE FROM ${table} ${whereClause.clause}`,
    params: [...whereClause.params],
  }
}
