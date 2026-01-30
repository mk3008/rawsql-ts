import { z, ZodError, type ZodType, type ZodTypeAny } from 'zod'
import {
  decimalStringToNumberUnsafe,
  bigintStringToBigInt,
} from '@rawsql-ts/sql-contract'
import {
  Mapper,
  type MapperOptions,
  type QueryParams,
  type EntityMapping as RowMapping,
} from '@rawsql-ts/sql-contract/mapper'

/**
 * Minimal mapper surface required by the Zod helpers.
 */
export interface MapperLike {
  query<T>(
    sql: string,
    params?: QueryParams,
    mappingOrOptions?: RowMapping<T> | MapperOptions
  ): Promise<T[]>
  queryOne<T>(
    sql: string,
    params?: QueryParams,
    mappingOrOptions?: RowMapping<T> | MapperOptions
  ): Promise<T | undefined>
}
/**
 * A Zod-aware reader bound to a schema and mapping.
 */
export interface ZodReader<T> {
  list(sql: string, params?: QueryParams): Promise<T[]>
  one(sql: string, params?: QueryParams): Promise<T>
}

declare module '@rawsql-ts/sql-contract/mapper' {
  interface Mapper {
    /**
     * Creates a reader that validates mapped DTOs with Zod, optionally using an explicit RowMapping.
     */
    zod<S extends ZodTypeAny>(schema: S): ZodReader<z.infer<S>>
    zod<S extends ZodTypeAny>(schema: S, mapping: RowMapping<z.infer<S>>): ZodReader<z.infer<S>>
  }
}


/**
 * Optional configuration that enriches error messages with a caller-defined label.
 */
export interface QueryZodOptions {
  /** Label prepended to any thrown `ZodError` so failures are easier to locate. */
  label?: string
}

/**
 * Executes the supplied mapper query and validates every mapped row against the schema.
 * Throws the raw `ZodError` if any row is invalid.
 *
 * @deprecated Use `mapper.zod(schema).list(...)` instead.
 */
export function queryZod<T>(mapper: MapperLike, schema: ZodType<T>, sql: string): Promise<T[]>
export function queryZod<T>(
  mapper: MapperLike,
  schema: ZodType<T>,
  sql: string,
  mappingOrOptions: RowMapping<T> | MapperOptions,
  options?: QueryZodOptions
): Promise<T[]>
export function queryZod<T>(
  mapper: MapperLike,
  schema: ZodType<T>,
  sql: string,
  params: QueryParams,
  options?: QueryZodOptions
): Promise<T[]>
export function queryZod<T>(
  mapper: MapperLike,
  schema: ZodType<T>,
  sql: string,
  params: QueryParams,
  mappingOrOptions: RowMapping<T> | MapperOptions,
  options?: QueryZodOptions
): Promise<T[]>
export async function queryZod<T>(
  mapper: MapperLike,
  schema: ZodType<T>,
  sql: string,
  ...rest: readonly unknown[]
): Promise<T[]> {
  const normalized = normalizeQueryArgs(rest as QueryZodRestArgs<T>)
  return executeQueryZod(mapper, schema, sql, normalized)
}

/**
 * Executes the supplied mapper query and validates a single row.
 * Throws when the mapper returns no rows and rethrows any `ZodError` produced during parsing.
 *
 * @deprecated Use `mapper.zod(schema).one(...)` instead.
 */
export function queryOneZod<T>(mapper: MapperLike, schema: ZodType<T>, sql: string): Promise<T>
export function queryOneZod<T>(
  mapper: MapperLike,
  schema: ZodType<T>,
  sql: string,
  mappingOrOptions: RowMapping<T> | MapperOptions,
  options?: QueryZodOptions
): Promise<T>
export function queryOneZod<T>(
  mapper: MapperLike,
  schema: ZodType<T>,
  sql: string,
  params: QueryParams,
  options?: QueryZodOptions
): Promise<T>
export function queryOneZod<T>(
  mapper: MapperLike,
  schema: ZodType<T>,
  sql: string,
  params: QueryParams,
  mappingOrOptions: RowMapping<T> | MapperOptions,
  options?: QueryZodOptions
): Promise<T>
export async function queryOneZod<T>(
  mapper: MapperLike,
  schema: ZodType<T>,
  sql: string,
  ...rest: readonly unknown[]
): Promise<T> {
  const normalized = normalizeQueryArgs(rest as QueryZodRestArgs<T>)
  const rows = await executeQueryZod(mapper, schema, sql, normalized)
  const prefix = normalized.options?.label ? `${normalized.options.label}: ` : ''
  if (rows.length === 0) {
    throw new Error(`${prefix}queryOneZod expected exactly one row but received none.`)
  }
  if (rows.length > 1) {
    throw new Error(
      `${prefix}queryOneZod expected exactly one row but received ${rows.length}.`
    )
  }
  return rows[0]
}

type QueryZodRestArgs<T> =
  | readonly []
  | readonly [RowMapping<T> | MapperOptions]
  | readonly [RowMapping<T> | MapperOptions, QueryZodOptions]
  | readonly [QueryParams]
  | readonly [QueryParams, QueryZodOptions]
  | readonly [QueryParams, RowMapping<T> | MapperOptions]
  | readonly [QueryParams, RowMapping<T> | MapperOptions, QueryZodOptions]

interface QueryZodNormalizedArgs<T> {
  params?: QueryParams
  mappingOrOptions?: RowMapping<T> | MapperOptions
  options?: QueryZodOptions
}

async function executeQueryZod<T>(
  mapper: MapperLike,
  schema: ZodType<T>,
  sql: string,
  args: QueryZodNormalizedArgs<T>
): Promise<T[]> {
  const rows = await mapper.query(sql, args.params ?? [], args.mappingOrOptions)
  return parseRows(schema, rows, args.options)
}

function normalizeQueryArgs<T>(rest: QueryZodRestArgs<T>): QueryZodNormalizedArgs<T> {
  const normalized: QueryZodNormalizedArgs<T> = {}
  if (rest.length === 0) {
    return normalized
  }

  const [first, second, third] = rest as [
    unknown,
    unknown,
    unknown
  ]

  if (rest.length === 1) {
    if (isRowMapping(first)) {
      normalized.mappingOrOptions = first
    } else if (isMapperOptions(first)) {
      normalized.mappingOrOptions = first
    } else {
      normalized.params = first as QueryParams
    }
    return normalized
  }

  if (rest.length === 2) {
    if (isRowMapping(first)) {
      normalized.mappingOrOptions = first
      normalized.options = second as QueryZodOptions | undefined
      return normalized
    }
    if (isMapperOptions(first)) {
      normalized.mappingOrOptions = first
      normalized.options = second as QueryZodOptions | undefined
      return normalized
    }

    normalized.params = first as QueryParams
    if (isRowMapping(second)) {
      normalized.mappingOrOptions = second
    } else if (isQueryZodOptions(second)) {
      normalized.options = second
    } else {
      normalized.mappingOrOptions = second as RowMapping<T> | MapperOptions
    }
    return normalized
  }

  normalized.params = first as QueryParams
  normalized.mappingOrOptions = second as RowMapping<T> | MapperOptions
  normalized.options = third as QueryZodOptions | undefined
  return normalized
}

function isRowMapping<T>(value: unknown): value is RowMapping<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'assignFields' in value &&
    typeof (value as RowMapping<T>).assignFields === 'function'
  )
}

function isMapperOptions(value: unknown): value is MapperOptions {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const optionKeys: Array<keyof MapperOptions> = [
    'keyTransform',
    'idKeysAsString',
    'typeHints',
    'coerceDates',
    'coerceFn',
  ]

  return optionKeys.some((key) => key in value)
}

function isQueryZodOptions(value: unknown): value is QueryZodOptions {
  return (
    typeof value === 'object' &&
    value !== null &&
    'label' in value
  )
}

/**
 * Validates the supplied row array with the schema.
 */
export function parseRows<T>(
  schema: ZodType<T>,
  rows: unknown,
  options?: QueryZodOptions
): T[] {
  return parseWithLabel(schema.array(), rows, options?.label)
}

/**
 * Validates a single row with the schema.
 */
export function parseRow<T>(
  schema: ZodType<T>,
  row: unknown,
  options?: QueryZodOptions
): T {
  return parseWithLabel(schema, row, options?.label)
}

/**
 * Explicit Zod helper that accepts numbers or numeric strings and yields a number.
 */
export const zNumberFromString = z
  .union([z.number(), z.string()])
  .transform((value) => {
    const coerced = decimalStringToNumberUnsafe(value)
    if (typeof coerced === 'number') {
      return coerced
    }
    throw new Error(`'${value}' is not a valid number.`)
  })

/**
 * Explicit Zod helper that accepts bigints or bigint strings and yields a bigint.
 */
export const zBigIntFromString = z
  .union([z.bigint(), z.string()])
  .transform((value) => {
    const coerced = bigintStringToBigInt(value)
    if (typeof coerced === 'bigint') {
      return coerced
    }
    throw new Error(`'${value}' is not a valid bigint.`)
  })

/**
 * Explicit Zod helper that accepts `Date` or ISO strings and yields a `Date`.
 */
export const zDateFromString = z
  .union([z.date(), z.string()])
  .transform((value) => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new Error('Date value is invalid.')
      }
      return value
    }

    const trimmed = value.trim()
    if (trimmed === '') {
      throw new Error('Value must be a non-empty date string.')
    }

    const timestamp = Date.parse(trimmed)
    if (Number.isNaN(timestamp)) {
      throw new Error(`'${value}' is not a valid date string.`)
    }

    return new Date(timestamp)
  })

function parseWithLabel<T>(schema: ZodType<T>, value: unknown, label?: string): T {
  try {
    return schema.parse(value)
  } catch (error) {
    annotateZodError(error, label)
  }
}

function annotateZodError(error: unknown, label?: string): never {
  if (label && error instanceof ZodError) {
    error.message = `${label}: ${error.message}`
  }
  throw error
}

function createZodReader<T>(
  mapper: Mapper,
  schema: ZodType<T>,
  mapping: RowMapping<T>
): ZodReader<T> {
  return {
    list: async (sql: string, params: QueryParams = []) => {
      const rows = await mapper.query<T>(sql, params, mapping)
      return parseRows(schema, rows)
    },
    one: async (sql: string, params: QueryParams = []) => {
      const rows = await mapper.query<T>(sql, params, mapping)
      return expectExactlyOneRow(parseRows(schema, rows))
    },
  }
}

function createZodPresetReader<T>(
  mapper: Mapper,
  schema: ZodType<T>
): ZodReader<T> {
  return {
    list: async (sql: string, params: QueryParams = []) => {
      const rows = await mapper.query<T>(sql, params)
      return parseRows(schema, rows)
    },
    one: async (sql: string, params: QueryParams = []) => {
      const rows = await mapper.query<T>(sql, params)
      return expectExactlyOneRow(parseRows(schema, rows))
    },
  }
}

function expectExactlyOneRow<T>(rows: T[]): T {
  if (rows.length === 0) {
    throw new Error('expected exactly one row but received none.')
  }
  if (rows.length > 1) {
    throw new Error(`expected exactly one row but received ${rows.length}.`)
  }
  return rows[0]
}

Mapper.prototype.zod = function zod<T>(
  schema: ZodType<T>,
  mapping?: RowMapping<T>
): ZodReader<T> {
  if (mapping) {
    return createZodReader(this, schema, mapping)
  }
  return createZodPresetReader(this, schema)
}
