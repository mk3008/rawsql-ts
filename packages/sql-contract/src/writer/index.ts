import type { QueryParams } from '../query-params'
import { writerPresets } from './presets'
import type { WriterPreset } from './presets'

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

/** Supported placeholder styles verified against the SQL formatter presets. */
export type PlaceholderStyle = 'indexed' | 'question' | 'named'

/** Per-statement options that remain specific to individual INSERT/UPDATE/DELETE calls. */
export interface WriterStatementOptions {
  allowUnsafeIdentifiers?: boolean
  /**
   * Optional columns to expose via a `RETURNING` clause; `'all'` maps to `RETURNING *`.
   * Sorted column lists guarantee deterministic SQL, and the writer itself stays DBMS-agnostic.
   */
  returning?: readonly string[] | 'all'
}

/** Legacy compatibility alias for historical usage. */
export type WriterCoreOptions = WriterStatementOptions

type ReturningMetaValue = readonly string[] | '*'

type ReturningClause = {
  clause: string
  meta: ReturningMetaValue
}

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const identifierControlPattern = /[\u0000-\u001F\u007F]/

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

const buildReturningClause = (
  returning: WriterStatementOptions['returning'],
  allowUnsafe: boolean,
): ReturningClause | undefined => {
  if (returning === undefined) {
    return undefined
  }

  if (returning === 'all') {
    return { clause: 'RETURNING *', meta: '*' }
  }

  if (!Array.isArray(returning)) {
    throw new Error('returning must be "all" or an array of column names')
  }

  if (returning.length === 0) {
    throw new Error('returning columns must not be empty')
  }

  const columns = returning.slice().sort((a, b) => a.localeCompare(b))
  for (const column of columns) {
    assertColumnIdentifier(column, allowUnsafe)
  }

  return {
    clause: `RETURNING ${columns.join(', ')}`,
    meta: columns as readonly string[],
  }
}

const finalizeStatement = (
  baseSql: string,
  params: QueryParams,
  returningClause?: ReturningClause,
) => {
  const sql = returningClause ? `${baseSql} ${returningClause.clause}` : baseSql
  const result: WriterStatementResult = { sql, params }

  if (returningClause) {
    result.meta = { returning: returningClause.meta }
  }

  return result
}

const buildWhereClause = (
  key: Key,
  allowUnsafe: boolean,
  binder: { bind(value: ParamValue, column: string): string },
) => {
  const entries = sortEntries(Object.entries(key))
  if (entries.length === 0) {
    throw new Error('where must not be empty')
  }

  const clauses = entries.map(([column, value]) => {
    assertColumnIdentifier(column, allowUnsafe)
    if (value === undefined) {
      throw new Error('key values must not be undefined')
    }
    return `${column} = ${binder.bind(value, column)}`
  })

  return {
    clause: `WHERE ${clauses.join(' AND ')}`,
  }
}

export type WriterStatementResult = {
  sql: string
  params: QueryParams
  meta?: {
    returning?: ReturningMetaValue
  }
}

export type WriterBuild = {
  insert(
    table: string,
    values: RecordValues,
    options?: WriterStatementOptions,
  ): WriterStatementResult
  update(
    table: string,
    values: RecordValues,
    where: Key,
    options?: WriterStatementOptions,
  ): WriterStatementResult
  remove(table: string, where: Key, options?: WriterStatementOptions): WriterStatementResult
}

export type WriterExecutor = (sql: string, params: QueryParams) => Promise<unknown>

export type Writer = {
  insert(table: string, values: RecordValues, options?: WriterStatementOptions): Promise<unknown>
  update(table: string, values: RecordValues, where: Key, options?: WriterStatementOptions): Promise<unknown>
  remove(table: string, where: Key, options?: WriterStatementOptions): Promise<unknown>
  build: WriterBuild
}

const createBuilderSet = (preset: WriterPreset): WriterBuild => ({
  insert: (table, values, options) => buildInsertStatement(table, values, options, preset),
  update: (table, values, where, options) =>
    buildUpdateStatement(table, values, where, options, preset),
  remove: (table, where, options) => buildRemoveStatement(table, where, options, preset),
})

const buildInsertStatement = (
  table: string,
  values: RecordValues,
  options: WriterStatementOptions | undefined,
  preset: WriterPreset,
): WriterStatementResult => {
  const allowUnsafe = options?.allowUnsafeIdentifiers === true
  const binder = preset.createBinder()
  assertTableIdentifier(table, allowUnsafe)
  const entries = sortEntries(Object.entries(values).filter(hasParamValueEntry))
  ensureEntries(entries, 'insert')

  const columns: string[] = []
  const placeholders: string[] = []
  for (const [column, value] of entries) {
    assertColumnIdentifier(column, allowUnsafe)
    columns.push(column)
    placeholders.push(binder.bind(value, column))
  }

  const returningClause = buildReturningClause(options?.returning, allowUnsafe)
  const baseSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`
  const result = finalizeStatement(baseSql, binder.params, returningClause)
  return preset.finalize?.(result) ?? result
}

const buildUpdateStatement = (
  table: string,
  values: RecordValues,
  where: Key,
  options: WriterStatementOptions | undefined,
  preset: WriterPreset,
): WriterStatementResult => {
  const allowUnsafe = options?.allowUnsafeIdentifiers === true
  const binder = preset.createBinder()
  assertTableIdentifier(table, allowUnsafe)
  const entries = sortEntries(Object.entries(values).filter(hasParamValueEntry))
  ensureEntries(entries, 'update')

  const clauses = entries.map(([column, value]) => {
    assertColumnIdentifier(column, allowUnsafe)
    return `${column} = ${binder.bind(value, column)}`
  })

  const whereClause = buildWhereClause(where, allowUnsafe, binder)
  const returningClause = buildReturningClause(options?.returning, allowUnsafe)
  const baseSql = `UPDATE ${table} SET ${clauses.join(', ')} ${whereClause.clause}`
  const result = finalizeStatement(baseSql, binder.params, returningClause)
  return preset.finalize?.(result) ?? result
}

const buildRemoveStatement = (
  table: string,
  where: Key,
  options: WriterStatementOptions | undefined,
  preset: WriterPreset,
): WriterStatementResult => {
  const allowUnsafe = options?.allowUnsafeIdentifiers === true
  const binder = preset.createBinder()
  assertTableIdentifier(table, allowUnsafe)
  const whereClause = buildWhereClause(where, allowUnsafe, binder)
  const returningClause = buildReturningClause(options?.returning, allowUnsafe)
  const baseSql = `DELETE FROM ${table} ${whereClause.clause}`
  const result = finalizeStatement(baseSql, binder.params, returningClause)
  return preset.finalize?.(result) ?? result
}

const legacyPreset = writerPresets.indexed()
const legacyBuilders = createBuilderSet(legacyPreset)

export const insert = legacyBuilders.insert
export const update = legacyBuilders.update
export const remove = legacyBuilders.remove

/** Creates a writer bound to the provided executor and preset-driven configuration. */
export function createWriterFromExecutor(
  executor: WriterExecutor,
  preset: WriterPreset = writerPresets.indexed(),
): Writer {
  const builders = createBuilderSet(preset)
  const execute =
    <T extends WriterBuild[keyof WriterBuild]>(builder: T) =>
    async (...args: Parameters<T>) => {
      const result = (builder as (...args: Parameters<T>) => WriterStatementResult)(...args)
      await executor(result.sql, result.params)
    }

  return {
    insert: execute(builders.insert),
    update: execute(builders.update),
    remove: execute(builders.remove),
    build: builders,
  }
}

/** Convenience alias for `createWriterFromExecutor`. */
export const createWriter = createWriterFromExecutor

export type { QueryParams } from '../query-params'
export { writerPresets }
export type { WriterPreset }
