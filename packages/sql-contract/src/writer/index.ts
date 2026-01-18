/** Primitive values that can be serialized as SQL parameters. */
export type ParamValue =
  | string
  | number
  | boolean
  | null
  | bigint
  | Date
  | Uint8Array

/** Values keyed by column that may include undefined entries which are dropped. */
export type RecordValues = Record<string, ParamValue | undefined>
/** Key columns used for equality-only WHERE clauses in update/remove helpers. */
export type Key = Record<string, ParamValue>

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const identifierControlPattern = /[\u0000-\u001F\u007F]/

/** Optional writer-core flags; use allowUnsafeIdentifiers when skipping ASCII checks. */
export type WriterCoreOptions = {
  allowUnsafeIdentifiers?: boolean
}

const assertIdentifierBasics = (identifier: string, kind: 'table' | 'column') => {
  if (identifier.length === 0) {
    throw new Error(`${kind} identifier must not be empty`)
  }

  if (identifierControlPattern.test(identifier)) {
    throw new Error(`identifier "${identifier}" must not contain control characters`)
  }
}

const assertColumnIdentifier = (identifier: string, allowUnsafe?: boolean) => {
  assertIdentifierBasics(identifier, 'column')
  if (!allowUnsafe && !identifierPattern.test(identifier)) {
    throw new Error(`column identifier "${identifier}" must match ${identifierPattern}`)
  }
}

const assertTableIdentifier = (identifier: string, allowUnsafe?: boolean) => {
  assertIdentifierBasics(identifier, 'table')
  if (!allowUnsafe && !identifierPattern.test(identifier)) {
    throw new Error(`table identifier "${identifier}" must match ${identifierPattern}`)
  }
}

const hasParamValueEntry = (entry: [string, ParamValue | undefined]): entry is [string, ParamValue] =>
  entry[1] !== undefined

const sortEntries = (entries: [string, ParamValue][]): [string, ParamValue][] =>
  entries.slice().sort(([a], [b]) => a.localeCompare(b))

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

const buildWhereClause = (
  key: Key,
  startIndex: number,
  allowUnsafe: boolean
) => {
  const entries = sortEntries(Object.entries(key))
  if (entries.length === 0) {
    throw new Error('where must not be empty')
  }

  const params: ParamValue[] = []
  const clauses = entries.map(([column, value], index) => {
    assertColumnIdentifier(column, allowUnsafe)
    if (value === undefined) {
      throw new Error('key values must not be undefined')
    }
    params.push(value)
    return `${column} = ${formatPlaceholder(startIndex + index)}`
  })

  // Build a flat AND list of equality checks with placeholders offset by the caller.
  return {
    clause: `WHERE ${clauses.join(' AND ')}`,
    params,
  }
}

/**
 * Build an INSERT statement that keeps SQL visible and drops undefined fields.
 * @param options – Pass `allowUnsafeIdentifiers` when you knowingly use Unicode names.
 */
export const insert = (table: string, values: RecordValues, options?: WriterCoreOptions) => {
  const allowUnsafe = options?.allowUnsafeIdentifiers === true
  assertTableIdentifier(table, allowUnsafe)
  const entries = sortEntries(Object.entries(values).filter(hasParamValueEntry))
  ensureEntries(entries, 'insert')

  const columns: string[] = []
  const params: ParamValue[] = []
  for (const [column, value] of entries) {
    assertColumnIdentifier(column, allowUnsafe)
    columns.push(column)
    params.push(value)
  }
  const columnsList = columns.join(', ')
  const placeholders = buildPlaceholders(params.length).join(', ')

  return {
    sql: `INSERT INTO ${table} (${columnsList}) VALUES (${placeholders})`,
    params,
  }
}

/**
 * Build an UPDATE statement that reuses parameterized placeholders and guards empty sets.
 * @param options – Pass `allowUnsafeIdentifiers` when you knowingly use Unicode names.
 */
export const update = (
  table: string,
  values: RecordValues,
  where: Key,
  options?: WriterCoreOptions,
) => {    
  const allowUnsafe = options?.allowUnsafeIdentifiers === true
  assertTableIdentifier(table, allowUnsafe)
  const entries = sortEntries(Object.entries(values).filter(hasParamValueEntry))
  ensureEntries(entries, 'update')

  const params: ParamValue[] = []
  const clauses = entries.map(([column, value]) => {
    assertColumnIdentifier(column, allowUnsafe)
    params.push(value)
    return `${column} = ${formatPlaceholder(params.length)}`
  })
  // Offset WHERE placeholders so they follow the SET parameters.
  const whereClause = buildWhereClause(where, params.length + 1, allowUnsafe)

  return {
    sql: `UPDATE ${table} SET ${clauses.join(', ')} ${whereClause.clause}`,
    params: [...params, ...whereClause.params],
  }
}

/**
 * Build a DELETE statement that only emits equality-only WHERE clauses.
 * @param options – Pass `allowUnsafeIdentifiers` when you knowingly use Unicode names.
 */
export const remove = (table: string, where: Key, options?: WriterCoreOptions) => {
  const allowUnsafe = options?.allowUnsafeIdentifiers === true
  assertTableIdentifier(table, allowUnsafe)
  const whereClause = buildWhereClause(where, 1, allowUnsafe)

  return {
    sql: `DELETE FROM ${table} ${whereClause.clause}`,
    params: [...whereClause.params],
  }
}
