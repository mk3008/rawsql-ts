import type { QueryParams } from '../query-params'

export type { QueryParams } from '../query-params'

/**
 * A single database row returned by a SQL driver.
 * Row keys are SQL column names, which must be strings; symbol keys are not supported.
 */
export type Row = Record<string, unknown>

/**
 * Executes SQL and returns the resulting rows.
 *
 * The mapper keeps this layer DBMS/driver agnostic; callers inject the concrete
 * executor that speaks to the desired database.
 */
export type QueryExecutor = (sql: string, params: QueryParams) => Promise<Row[]>

/**
 * Defines how a column prefix, key, and optional overrides describe a row mapping.
 */
export interface RowMappingOptions<T, K extends Extract<keyof T, string>> {
  name: string
  key: K
  prefix?: string
  columnMap?: Partial<Record<Extract<keyof T, string>, string>>
  coerce?: boolean
  /**
   * Row mappings rely on a very narrow coercion helper; it only receives the
   * raw column value so callers can swap in their own rules.
   */
  coerceFn?: (value: unknown) => unknown
}

export type { RowMappingOptions as EntityOptions }

/**
 * Describes how a child mapping references a parent mapping.
 */
export interface BelongsToOptions {
  optional?: boolean
}

/**
 * Controls how raw column names are normalized for simple mapping.
 */
export type KeyTransform =
  | 'snake_to_camel'
  | 'none'
  | ((column: string) => string)

/**
 * Supported type hints for `mapSimpleRows`, controlling how primitive values are coerced before identifier normalization.
 */
export type SimpleMapTypeHint = 'string' | 'number' | 'boolean' | 'date' | 'bigint'

/**
 * Options that influence simple (duck-typed) row mapping.
 */
export interface MapperOptions {
  keyTransform?: KeyTransform
  idKeysAsString?: boolean
  typeHints?: Record<string, SimpleMapTypeHint>
  coerceDates?: boolean
  /**
   * Receives both the normalized property name and the original column name so callers
   * can implement property-specific logic without re-running normalization.
   */
  coerceFn?: (args: {
    key: string
    sourceKey: string
    value: unknown
  }) => unknown
}

/**
 * A mapping-bound reader that executes SQL and enforces row-count contracts.
 */
export interface MapperReader<T> {
  list(sql: string, params?: QueryParams): Promise<T[]>
  one(sql: string, params?: QueryParams): Promise<T>
  scalar(sql: string, params?: QueryParams): Promise<unknown>
  validator<U>(validator: ReaderValidatorInput<T, U>): MapperReader<U>
}

/**
 * Validates a mapped value and returns the validated output.
 */
export type ReaderValidator<T, U = T> = (value: T) => U

export interface ReaderSchemaLike<U = unknown> {
  parse(value: any): U
}

export type ReaderValidatorInput<T, U = T> =
  | ReaderValidator<T, U>
  | ReaderSchemaLike<U>

/**
 * Named presets for simple mapping that avoid implicit inference.
 */
export const mapperPresets = {
  safe(): MapperOptions {
    return {
      keyTransform: 'none',
      coerceDates: false,
    }
  },
  appLike(): MapperOptions {
    return {
      keyTransform: 'snake_to_camel',
      coerceDates: true,
      coerceFn: ({ value }) => coerceColumnValue(value),
    }
  },
}

type ParentLink<T> = {
  propertyName: string
  parent: RowMapping<any>
  localKey: string
  optional: boolean
}

type TraceFrame = {
  entity: string
  relation?: string
  key: string
}

type RowContext = {
  row: Row
  normalizedColumns: Map<string, string>
}

/**
 * Builds a row mapping that can be consumed by {@link Mapper#query} or {@link mapRows}.
 */
export class RowMapping<
  T,
  K extends Extract<keyof T, string> = Extract<keyof T, string>
> {
  readonly name: string
  readonly key: K
  readonly prefix: string
  readonly parents: ParentLink<T>[] = []

  private readonly columnMap: Record<string, string>
  private readonly overrideLookup: Map<string, string>
  private readonly prefixNormalized: string
  private readonly prefixLength: number
  private readonly shouldCoerce: boolean
  private readonly coerceFn: (value: unknown) => unknown

  constructor(options: RowMappingOptions<T, K>) {
    this.name = options.name
    this.key = options.key
    this.prefix = options.prefix ?? ''
    this.columnMap = {}
    this.overrideLookup = new Map()

    if (options.columnMap) {
      for (const [property, column] of Object.entries(options.columnMap)) {
        if (typeof column !== 'string') {
          throw new Error(
            `RowMapping "${this.name}" columnMap["${property}"] must be a string.`
          )
        }
        this.columnMap[property] = column
        this.overrideLookup.set(column.toLowerCase(), property)
      }
    }

    if (!this.prefix && this.overrideLookup.size === 0) {
      throw new Error(
        `RowMapping "${this.name}" must define either "prefix" or "columnMap".`
      )
    }

    this.prefixNormalized = this.prefix.toLowerCase()
    this.prefixLength = this.prefixNormalized.length
    this.shouldCoerce = options.coerce ?? true
    this.coerceFn = options.coerceFn ?? coerceColumnValue
  }

  /**
   * Registers a parent relationship that will be attached after the current row is mapped.
   */
  belongsTo<P, PK extends Extract<keyof P, string>>(
    propertyName: Extract<keyof T, string>,
    parent: RowMapping<P, PK>,
    localKey: Extract<keyof T, string>,
    options?: BelongsToOptions
  ): this {
    const optional = options?.optional ?? false
    this.parents.push({
      propertyName: String(propertyName),
      parent,
      localKey,
      optional,
    })
    return this
  }

  /**
   * Registers a parent relationship with an explicit local key.
   */
  belongsToWithLocalKey<P, PK extends Extract<keyof P, string>>(
    propertyName: Extract<keyof T, string>,
    parent: RowMapping<P, PK>,
    localKey: Extract<keyof T, string>
  ): this {
    return this.belongsTo(propertyName, parent, localKey)
  }

  /**
   * Registers an optional parent relationship with an explicit local key.
   */
  belongsToOptional<P, PK extends Extract<keyof P, string>>(
    propertyName: Extract<keyof T, string>,
    parent: RowMapping<P, PK>,
    localKey?: Extract<keyof T, string>
  ): this {
    if (localKey == null) {
      throw new Error(
        `localKey is required when declaring optional relation "${String(
          propertyName
        )}" on "${this.name}"`
      )
    }
    return this.belongsTo(propertyName, parent, localKey, { optional: true })
  }

  matchColumn(columnName: string): string | undefined {
    const normalized = columnName.toLowerCase()
    const override = this.overrideLookup.get(normalized)
    if (override) {
      return override
    }

    if (!this.prefixNormalized) {
      // When no prefix is provided we rely on explicit column overrides.
      return undefined
    }

    if (!normalized.startsWith(this.prefixNormalized)) {
      return undefined
    }

    // prefix is expected to include trailing '_' (e.g. 'item_') so remainder begins with the column part.
    // Prefix matching is case-insensitive and purely string-based.
    // If the prefix lacks '_', remainder may begin mid-token; prefer "item_" style prefixes.
    const remainder = normalized.slice(this.prefixLength)
    return remainder ? toCamelCase(remainder) : undefined
  }

  resolveColumnName(propertyName: string): string {
    if (this.columnMap[propertyName]) {
      return this.columnMap[propertyName]
    }

    if (!this.prefix) {
      return propertyName
    }

    if (propertyName.toLowerCase().startsWith(this.prefixNormalized)) {
      return propertyName
    }

    return `${this.prefix}${toSnakeCase(propertyName)}`
  }

  readKeyValue(ctx: RowContext): unknown {
    const column = this.resolveColumnName(this.key)
    return getRowValue(ctx, column)
  }

  assignFields(target: Record<string, unknown>, ctx: RowContext): void {
    for (const column of Object.keys(ctx.row)) {
      const propertyName = this.matchColumn(column)
      if (!propertyName) {
        continue
      }
      target[propertyName] = this.normalizeColumnValue(ctx.row[column])
    }
  }

  private normalizeColumnValue(value: unknown): unknown {
    if (!this.shouldCoerce) {
      return value
    }
    return this.coerceFn(value)
  }
}

export { RowMapping as EntityMapping }

/**
 * Creates a new row mapping from the provided options.
 */
export function rowMapping<
  T,
  K extends Extract<keyof T, string> = Extract<keyof T, string>
>(options: RowMappingOptions<T, K>): RowMapping<T, K> {
  return new RowMapping<T, K>(options)
}

/**
 * @deprecated Use {@link rowMapping} instead.
 */
export function entity<
  T,
  K extends Extract<keyof T, string> = Extract<keyof T, string>
>(options: RowMappingOptions<T, K>): RowMapping<T, K> {
  return rowMapping(options)
}

/**
 * Builds a column map by prefixing each property with the provided prefix and
 * converting property names to snake_case.
 */
export function columnMapFromPrefix<K extends string>(
  prefix: string,
  properties: readonly K[]
): Record<K, string> {
  const columnMap = {} as Record<K, string>
  for (const property of properties) {
    columnMap[property] = `${prefix}${toSnakeCase(String(property))}`
  }
  return columnMap
}

/**
 * Executes SQL via the provided executor and maps the rows using the supplied mapping.
 */
export class Mapper {
  constructor(
    private readonly executor: QueryExecutor,
    private readonly defaults: MapperOptions | undefined = undefined
  ) {}

  async query<T>(
    sql: string,
    params: QueryParams,
    mapping: RowMapping<T>
  ): Promise<T[]>
  async query<T>(
    sql: string,
    params?: QueryParams,
    options?: MapperOptions
  ): Promise<T[]>
  async query<T>(
    sql: string,
    params: QueryParams = [],
    mappingOrOptions?: RowMapping<T> | MapperOptions
  ): Promise<T[]> {
    const rows = await this.executor(sql, params)
    if (mappingOrOptions instanceof RowMapping) {
      return mapRows(rows, mappingOrOptions)
    }

    return mapSimpleRows<T>(
      rows,
      mergeMapperOptions(this.defaults, mappingOrOptions)
    )
  }

  async queryOne<T>(
    sql: string,
    params: QueryParams,
    mapping: RowMapping<T>
  ): Promise<T | undefined>
  async queryOne<T>(
    sql: string,
    params?: QueryParams,
    options?: MapperOptions
  ): Promise<T | undefined>
  async queryOne<T>(
    sql: string,
    params: QueryParams = [],
    mappingOrOptions?: RowMapping<T> | MapperOptions
  ): Promise<T | undefined> {
    // Narrow mappingOrOptions before invoking the overload so the compiler can
    // select the expected signature.
    if (mappingOrOptions instanceof RowMapping) {
      const rows = await this.query<T>(sql, params, mappingOrOptions)
      return rows[0]
    }

    const rows = await this.query<T>(sql, params, mappingOrOptions)
    return rows[0]
  }

  /**
   * Binds a structured row mapping to a reader that exposes `list` and `one`.
   */
  bind<T>(mapping: RowMapping<T>): MapperReader<T> {
    const createReader = <U>(
      currentValidator?: ReaderValidator<T, U>
    ): MapperReader<U> => {
      const validateRows = (rows: T[]): U[] =>
        applyRowValidator(rows, currentValidator)
      const validateValue = (value: unknown): U =>
        applyScalarValidator(value, currentValidator)

      const validator = <V>(
        nextValidator: ReaderValidatorInput<U, V>
      ): MapperReader<V> => {
        const normalizedNext = normalizeReaderValidator(nextValidator)
        const composed = composeValidators(currentValidator, normalizedNext)
        return createReader(composed)
      }

      return {
        list: async (sql: string, params: QueryParams = []) => {
          const rows = await this.query<T>(sql, params, mapping)
          return validateRows(rows)
        },
        one: async (sql: string, params: QueryParams = []) => {
          const rows = await this.query<T>(sql, params, mapping)
          const row = expectExactlyOneRow(rows)
          return validateValue(row)
        },
        scalar: async (sql: string, params: QueryParams = []) => {
          const value = await readScalarValue(this.executor, sql, params)
          return validateValue(value)
        },
        validator,
      }
    }

    return createReader()
  }
}

/**
 * This package maps rows and does not manage DB drivers.
 * Inject a query executor rather than wiring connections inside the mapper.
 */
export function createMapper(
  executor: QueryExecutor,
  defaults?: MapperOptions
): Mapper {
  return new Mapper(executor, defaults)
}

/**
 * Creates a mapper using the supplied executor and user defaults.
 * This helper is the recommended entry point when wiring an executor because
 * it clearly signals where defaults are configured.
 */
export function createMapperFromExecutor(
  executor: QueryExecutor,
  defaults?: MapperOptions
): Mapper {
  return createMapper(executor, defaults)
}

/**
 * Creates a reader-bound mapper using the supplied executor.
 * When no overrides are provided, the app-like preset is applied so snake_case
 * columns are normalized to camelCase keys by default.
 */
export function createReader(
  executor: QueryExecutor,
  options?: MapperOptions
): Mapper {
  const resolvedOptions = {
    ...mapperPresets.appLike(),
    ...options,
  }
  if (options?.idKeysAsString === undefined) {
    resolvedOptions.idKeysAsString = false
  }
  return createMapperFromExecutor(executor, resolvedOptions)
}

/**
 * Normalizes an executor returning `{ rows }` so it can be consumed by the mapper.
 */
export function toRowsExecutor(
  executorOrTarget:
    | ((
        sql: string,
        params: QueryParams
      ) => Promise<{ rows: Row[] } | { rows: Row[]; rowCount?: number } | Row[]>)
    | { [key: string]: (...args: unknown[]) => Promise<unknown> },
  methodName?: string
): QueryExecutor {
  if (typeof executorOrTarget === 'function') {
    return async (sql, params) => {
      const result = await executorOrTarget(sql, params)
      if (Array.isArray(result)) {
        return result
      }
      if ('rows' in result) {
        return (result as { rows: Row[] }).rows
      }
      return []
    }
  }

  const executor = async (sql: string, params: QueryParams) => {
    if (!methodName) {
      throw new Error('Method name is required when passing an object/key pair')
    }
    const method = executorOrTarget[methodName]
    if (typeof method !== 'function') {
      throw new Error(`Method "${methodName}" not found on target`)
    }
    const result = await method.call(executorOrTarget, sql, params)
    if (Array.isArray(result)) {
      return result
    }
    if (result && typeof result === 'object' && 'rows' in result) {
      return (result as { rows: Row[] }).rows
    }
    return []
  }

  return executor
}

/**
 * Maps a pre-fetched row array into typed objects defined by a row mapping.
 * Row values remain `unknown`, and the mapper only applies the general-purpose
 * coercion rules declared in `coerceColumnValue`.
 */
export function mapRows<T>(rows: Row[], mapping: RowMapping<T>): T[] {
  const cache = new Map<RowMapping<any>, Map<string, unknown>>()
  const roots = new Map<string, T>()

  // Deduplicate root entities by key so joined rows map back to the same object.
  for (const row of rows) {
    const ctx = createRowContext(row)
    const keyValue = mapping.readKeyValue(ctx)
    if (keyValue === undefined || keyValue === null) {
      throw new Error(
        `Missing key column for root mapping "${mapping.name}" in row ${JSON.stringify(
          row
        )}`
      )
    }

    const keyString = stringifyKey(keyValue)
    const entity = buildEntity(
      ctx,
      mapping,
      cache,
      new Set(),
      [] as TraceFrame[],
      undefined
    )

    // Always hydrate parents per row; cache reuses existing entity references.
    if (!roots.has(keyString)) {
      roots.set(keyString, entity)
    }
  }

  return Array.from(roots.values())
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

function readScalarValue(
  executor: QueryExecutor,
  sql: string,
  params: QueryParams
): Promise<unknown> {
  return executor(sql, params).then((rows) => extractScalar(rows))
}

function extractScalar(rows: Row[]): unknown {
  const row = expectExactlyOneRow(rows)
  const columns = Object.keys(row)
  if (columns.length !== 1) {
    throw new Error(`expected exactly one column but received ${columns.length}.`)
  }
  return row[columns[0]]
}

function applyRowValidator<T, U>(
  rows: T[],
  validator?: ReaderValidator<T, U>
): U[] {
  if (!validator) {
    return rows as unknown as U[]
  }
  return rows.map((row) => validator(row))
}

function applyScalarValidator<T, U>(
  value: unknown,
  validator?: ReaderValidator<T, U>
): U {
  if (!validator) {
    return value as unknown as U
  }
  return validator(value as T)
}

function isReaderSchemaLike<T, U>(
  value: ReaderValidatorInput<T, U>
): value is ReaderSchemaLike<U> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ReaderSchemaLike<U>).parse === 'function'
  )
}

function normalizeReaderValidator<T, U>(
  validator?: ReaderValidatorInput<T, U>
): ReaderValidator<T, U> | undefined {
  if (!validator) {
    return undefined
  }
  if (isReaderSchemaLike(validator)) {
    const schema = validator
    return (value: T) =>
      schema.parse(value as Parameters<typeof schema.parse>[0])
  }
  return validator
}

function composeValidators<T, U, V>(
  first?: ReaderValidator<T, U>,
  second?: ReaderValidator<U, V>
): ReaderValidator<T, V> | undefined {
  if (!first) {
    return second as unknown as ReaderValidator<T, V> | undefined
  }
  if (!second) {
    return first as unknown as ReaderValidator<T, V>
  }
  return (value: T) => second(first(value))
}

const builtinMapperOptions: Required<
  Pick<MapperOptions, 'keyTransform' | 'idKeysAsString'>
> = {
  keyTransform: 'snake_to_camel',
  idKeysAsString: true,
}

function mergeTypeHints(
  defaults?: Record<string, SimpleMapTypeHint>,
  overrides?: Record<string, SimpleMapTypeHint>
): Record<string, SimpleMapTypeHint> | undefined {
  if (!defaults && !overrides) {
    return undefined
  }
  return {
    ...(defaults ?? {}),
    ...(overrides ?? {}),
  }
}

function mergeMapperOptions(
  defaults?: MapperOptions,
  overrides?: MapperOptions
): MapperOptions | undefined {
  const keyTransform =
    overrides?.keyTransform ??
    defaults?.keyTransform ??
    builtinMapperOptions.keyTransform
  const coerceDates = overrides?.coerceDates ?? defaults?.coerceDates
  const coerceFn = overrides?.coerceFn ?? defaults?.coerceFn
  const typeHints = mergeTypeHints(defaults?.typeHints, overrides?.typeHints)
  const idKeysAsString =
    overrides?.idKeysAsString ??
    defaults?.idKeysAsString ??
    builtinMapperOptions.idKeysAsString

  return {
    keyTransform,
    coerceDates,
    coerceFn,
    typeHints,
    idKeysAsString,
  }
}

function createKeyTransformFn(
  transform?: KeyTransform
): (column: string) => string {
  if (!transform || transform === 'snake_to_camel') {
    return snakeToCamel
  }
  if (transform === 'none') {
    return (column) => column
  }
  if (typeof transform === 'function') {
    return transform
  }
  return snakeToCamel
}

/**
 * Maps pre-fetched rows into typed DTOs using the simple map preset, honoring key transforms, type hints, and optional coercion settings.
 *
 * @template T Target DTO shape.
 * @param rows Rows produced by the SQL executor.
 * @param options Optional overrides that control key normalization, coercion, and type hints.
 * @returns An array of `T` instances synthesized from `rows`.
 */
export function mapSimpleRows<T>(
  rows: Row[],
  options?: MapperOptions
): T[] {
  const coerceFn = options?.coerceFn
  const keyTransform =
    options?.keyTransform ?? builtinMapperOptions.keyTransform
  const keyTransformFn = createKeyTransformFn(keyTransform)
  const shouldCoerceDates = options?.coerceDates ?? false
  const typeHints = options?.typeHints
  const idKeysAsString =
    options?.idKeysAsString ?? builtinMapperOptions.idKeysAsString

  return rows.map((row) => {
    const dto: Record<string, unknown> = {}
    const seen = new Map<string, string>()

    // Map each column to a camelCase key while detecting naming collisions.
    for (const [column, rawValue] of Object.entries(row)) {
      const propertyName = keyTransformFn(column)
      if (!propertyName) {
        continue
      }

      const existing = seen.get(propertyName)
      if (existing && existing !== column) {
        throw new Error(
          `Column "${column}" conflicts with "${existing}" after camelCase normalization ("${propertyName}").`
        )
      }

      seen.set(propertyName, column)
      const columnHint = typeHints?.[propertyName]
      let normalizedValue: unknown = rawValue
      const shouldStringifyIdentifier =
        !columnHint && idKeysAsString && isIdentifierProperty(propertyName)

      if (columnHint) {
        normalizedValue = applyTypeHint(
          normalizedValue,
          columnHint,
          propertyName
        )
      } else if (shouldCoerceDates && typeof normalizedValue === 'string') {
        normalizedValue = coerceDateValue(normalizedValue)
      }

      if (shouldStringifyIdentifier) {
        normalizedValue = stringifyIdentifierValue(normalizedValue)
      }

      const coercedValue =
        coerceFn?.({
          key: propertyName,
          sourceKey: column,
          value: normalizedValue,
        }) ?? normalizedValue

      dto[propertyName] = shouldStringifyIdentifier
        ? stringifyIdentifierValue(coercedValue)
        : coercedValue
    }

    return dto as T
  })
}

/**
 * Date coercion helper that mirrors the ISO-with-timezone restriction used by the
 * structured mapper. Only strings already matching the ISO 8601 timestamp-with-offset
 * pattern are converted to Date.
 */
function coerceDateValue(value: string): unknown {
  const trimmed = value.trim()
  let normalized = trimmed.includes(' ')
    ? trimmed.replace(' ', 'T')
    : trimmed

  if (/[+-]\d{2}$/.test(normalized)) {
    normalized = `${normalized}:00`
  }

  if (isoDateTimeRegex.test(normalized)) {
    const parsed = Date.parse(normalized)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed)
    }
  }
  return value
}

function applyTypeHint(
  value: unknown,
  hint: SimpleMapTypeHint,
  propertyName?: string
): unknown {
  if (value === undefined || value === null) {
    return value
  }

  switch (hint) {
    case 'string':
      if (typeof value === 'string') {
        return value
      }
      if (typeof value === 'number' || typeof value === 'bigint') {
        return String(value)
      }
      return value
    case 'number':
      if (typeof value === 'number') {
        return value
      }
      if (typeof value === 'string') {
        const parsed = Number(value)
        if (!Number.isNaN(parsed)) {
          return parsed
        }
      }
      return value
    case 'boolean':
      if (typeof value === 'boolean') {
        return value
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (normalized === 'true') {
          return true
        }
        if (normalized === 'false') {
          return false
        }
      }
      return value
    case 'date':
      if (value instanceof Date) {
        return value
      }
      if (typeof value === 'string') {
        const coerced = coerceDateValue(value)
        if (coerced instanceof Date) {
          return coerced
        }
      }
      return value
    case 'bigint':
      if (typeof value === 'bigint') {
        return value
      }
      if (typeof value === 'number') {
        return BigInt(value)
      }
      if (typeof value === 'string') {
        try {
          return BigInt(value)
        } catch {
          throw new Error(
            `Type hint 'bigint' failed for "${propertyName ?? 'value'}": "${value}" is not a valid bigint.`
          )
        }
      }
      return value
  }
}

function isIdentifierProperty(propertyName: string): boolean {
  if (propertyName === 'id') {
    return true
  }
  if (!propertyName.endsWith('Id')) {
    return false
  }

  const firstChar = propertyName.charAt(0)
  if (firstChar !== firstChar.toLowerCase()) {
    return false
  }

  // Only treat camelCase names ending in 'Id' (uppercase I, lowercase d) as identifiers.
  return true
}

function stringifyIdentifierValue(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }
  return value
}

function buildEntity<T>(
  ctx: RowContext,
  mapping: RowMapping<T>,
  cache: Map<RowMapping<any>, Map<string, unknown>>,
  visited: Set<string>,
  stack: TraceFrame[],
  relation?: string
): T {
  const { entity, isNew, keyString } = getOrCreateEntity(ctx, mapping, cache)
  const visitKey = `${mapping.name}:${keyString}`
  const currentFrame: TraceFrame = {
    entity: mapping.name,
    relation,
    key: keyString,
  }

  if (visited.has(visitKey)) {
    const cyclePath = [...stack, currentFrame]
      .map((frame) => formatFrame(frame))
      .join(' -> ')
    throw new Error(`Circular row mapping detected: ${cyclePath}`)
  }

  visited.add(visitKey)
  stack.push(currentFrame)
  try {
    if (isNew) {
      mapping.assignFields(entity as Record<string, unknown>, ctx)
    }

    hydrateParents(entity, ctx, mapping, cache, visited, stack)
    return entity
  } finally {
    visited.delete(visitKey)
    stack.pop()
  }
}

function getOrCreateEntity<T>(
  ctx: RowContext,
  mapping: RowMapping<T>,
  cache: Map<RowMapping<any>, Map<string, unknown>>
): { entity: T; isNew: boolean; keyString: string } {
  const keyValue = mapping.readKeyValue(ctx)
  if (keyValue === undefined || keyValue === null) {
    throw new Error(
      `Missing key column for mapping "${mapping.name}" during recursion.`
    )
  }

  let keyString: string
  try {
    keyString = stringifyKey(keyValue)
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` (${error.message})` : ''
    throw new Error(
      `Row mapping "${mapping.name}" key must be JSON-serializable${detail}.`
    )
  }
  let entitySet = cache.get(mapping)
  if (!entitySet) {
    entitySet = new Map()
    cache.set(mapping, entitySet)
  }

  const existing = entitySet.get(keyString) as T | undefined
  if (existing) {
    return { entity: existing, isNew: false, keyString }
  }

  const newEntity = {} as T
  entitySet.set(keyString, newEntity)
  return { entity: newEntity, isNew: true, keyString }
}

function hydrateParents<T>(
  entity: T,
  ctx: RowContext,
  mapping: RowMapping<T>,
  cache: Map<RowMapping<any>, Map<string, unknown>>,
  visited: Set<string>,
  stack: TraceFrame[]
): void {
  for (const parent of mapping.parents) {
    const localColumn = mapping.resolveColumnName(parent.localKey)
    const normalizedLocalColumn = localColumn.toLowerCase()

    if (!ctx.normalizedColumns.has(normalizedLocalColumn)) {
      missingLocalKey(
        mapping.name,
        parent.propertyName,
        localColumn,
        parent.parent.name
      )
    }

    const localKeyValue = getRowValue(ctx, localColumn)

    if (localKeyValue === undefined || localKeyValue === null) {
      if (parent.optional) {
        continue
      }
      localKeyIsNull(
        mapping.name,
        parent.propertyName,
        localColumn,
        parent.parent.name
      )
    }

    const parentKeyColumn = parent.parent.resolveColumnName(parent.parent.key)
    const normalizedParentKeyColumn = parentKeyColumn.toLowerCase()
    if (!ctx.normalizedColumns.has(normalizedParentKeyColumn)) {
      missingParentKeyColumn(
        mapping.name,
        parent.propertyName,
        parent.parent.name,
        parentKeyColumn
      )
    }
    const parentKeyValue = getRowValue(ctx, parentKeyColumn)

    if (parentKeyValue === undefined || parentKeyValue === null) {
      if (parent.optional) {
        continue
      }
      throw new Error(
        `Missing key column "${parentKeyColumn}" for parent mapping "${parent.parent.name}"`
      )
    }

    const parentEntity = buildEntity(
      ctx,
      parent.parent,
      cache,
      visited,
      stack,
      parent.propertyName
    )
    ;(entity as Record<string, unknown>)[parent.propertyName] = parentEntity
  }
}

function createRowContext(row: Row): RowContext {
  const normalized = new Map<string, string>()
  for (const column of Object.keys(row)) {
    normalized.set(column.toLowerCase(), column)
  }
  return { row, normalizedColumns: normalized }
}

function getRowValue(ctx: RowContext, columnName: string): unknown {
  const actual = ctx.normalizedColumns.get(columnName.toLowerCase())
  if (!actual) {
    return undefined
  }
  return ctx.row[actual]
}

function coerceColumnValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return value
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed)
    if (!Number.isNaN(numeric)) {
      return numeric
    }
  }

  const lower = trimmed.toLowerCase()
  if (lower === 'true' || lower === 'false') {
    return lower === 'true'
  }

  // Mapper should stay DBMS-agnostic; Date coercion is intentionally limited to ISO 8601 datetime strings that include a timezone designator.
  const isIsoDateTime = isoDateTimeRegex.test(trimmed)
  if (isIsoDateTime) {
    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed)
    }
  }

  return value
}

const isoDateTimeRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/

function stringifyKey(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value)
    } catch {
    throw new Error('Row mapping key must be JSON-serializable.')
    }
  }
  return String(value)
}

function missingLocalKey(
  mappingName: string,
  propertyName: string,
  localColumn: string,
  parentName: string
): never {
  throw new Error(
    `Missing local key column "${localColumn}" for relation "${propertyName}" on ${mappingName} (parent ${parentName})`
  )
}

function missingParentKeyColumn(
  mappingName: string,
  propertyName: string,
  parentName: string,
  parentKeyColumn: string
): never {
  throw new Error(
    `Missing key column "${parentKeyColumn}" for parent "${parentName}" relation "${propertyName}" on ${mappingName}`
  )
}

function localKeyIsNull(
  mappingName: string,
  propertyName: string,
  localColumn: string,
  parentName: string
): never {
  throw new Error(
    `Local key column "${localColumn}" is null for relation "${propertyName}" on ${mappingName} (parent ${parentName})`
  )
}

function formatFrame(frame: TraceFrame): string {
  const relationSuffix = frame.relation ? `.${frame.relation}` : ''
  return `${frame.entity}${relationSuffix}(${frame.key})`
}
                
function snakeToCamel(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.includes('_')) {
    return toCamelCase(trimmed)
  }

  if (trimmed === trimmed.toUpperCase()) {
    return trimmed.toLowerCase()
  }

  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`
}

function toCamelCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((segment, index) =>
      index === 0
        ? segment.toLowerCase()
        : `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}`
    )
    .join('')
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([A-Z])/g, '_$1')
    .replace(/__+/g, '_')
    .toLowerCase()
    .replace(/^_+/, '')
}
                  

