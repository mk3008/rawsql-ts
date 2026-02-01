import type { QueryParams } from '../query-params'
import type { QueryExecutor, Row, RowMapping } from '../mapper'
import { mapRows } from '../mapper'

/**
 * Describes the contract that couples a SQL file, its parameters, and its output shape.
 */
export type QuerySpec<P extends QueryParams = QueryParams, R = Row> = {
  id: string
  sqlFile: string
  params: {
    shape: 'positional' | 'named'
    example: P
  }
  output: {
    mapping?: RowMapping<R>
    validate?: (row: unknown) => R
    example: R
  }
  notes?: string
  tags?: Record<string, string>
  zsg?: {
    allow?: unknown
    optionsExample?: unknown
  }
}

/**
 * Executes catalog-backed SQL specs.
 */
export interface CatalogExecutor {
  one<P extends QueryParams, R>(
    spec: QuerySpec<P, R>,
    params: P,
    options?: unknown
  ): Promise<R>
  list<P extends QueryParams, R>(
    spec: QuerySpec<P, R>,
    params: P,
    options?: unknown
  ): Promise<R[]>
  scalar<P extends QueryParams, R>(
    spec: QuerySpec<P, R>,
    params: P,
    options?: unknown
  ): Promise<R>
}

/**
 * Loads SQL content by name without hard dependencies on fs or bundlers.
 */
export interface SQLLoader {
  load(sqlFile: string): Promise<string>
}

/**
 * Converts catalog param representations into positional arrays.
 */
export interface Binder {
  name: string
  bind(input: {
    specId: string
    sql: string
    params: unknown[] | Record<string, unknown>
  }): {
    sql: string
    params: unknown[]
  }
}

/**
 * Applies semantic-preserving SQL rewrites as additional opt-in adapters.
 */
export interface Rewriter {
  name: string
  rewrite(input: {
    specId: string
    spec: QuerySpec<any, any>
    sql: string
    params: QueryParams
    options?: unknown
  }): {
    sql: string
    params: QueryParams
  }
}

/**
 * Root error class for catalog execution failures.
 */
export class CatalogError extends Error {
  readonly specId?: string
  readonly cause?: unknown

  constructor(message: string, specId?: string, cause?: unknown) {
    super(message)
    this.name = this.constructor.name
    this.specId = specId
    this.cause = cause
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class SQLLoaderError extends CatalogError {}
export class RewriterError extends CatalogError {}
export class BinderError extends CatalogError {}
export class CatalogExecutionError extends CatalogError {}

function assertPositionalParams(
  specId: string,
  params: unknown
): unknown[] {
  if (!Array.isArray(params)) {
    throw new CatalogExecutionError(
      `Spec "${specId}" expects positional parameters.`,
      specId
    )
  }
  return params
}

function assertNamedParams(
  specId: string,
  params: unknown
): Record<string, unknown> {
  if (
    params === null ||
    typeof params !== 'object' ||
    Array.isArray(params)
  ) {
    throw new CatalogExecutionError(
      `Spec "${specId}" expects named parameters.`,
      specId
    )
  }
  return params as Record<string, unknown>
}

function assertParamsShape<P extends QueryParams, R>(
  specId: string,
  expectedShape: QuerySpec<P, R>['params']['shape'],
  params: unknown
): QueryParams {
  if (expectedShape === 'positional') {
    return assertPositionalParams(specId, params)
  }
  return assertNamedParams(specId, params)
}

/**
 * Configuration for wiring a CatalogExecutor implementation.
 */
export interface CatalogExecutorOptions {
  executor: QueryExecutor
  loader: SQLLoader
  rewriters?: Rewriter[]
  binders?: Binder[]
  sqlCache?: Map<string, string>
  allowNamedParamsWithoutBinder?: boolean
}

/**
 * Creates a CatalogExecutor that enforces the QuerySpec contract and applies
 * optional rewriters and binders before delegating to the target query executor.
 */
export function createCatalogExecutor(
  options: CatalogExecutorOptions
): CatalogExecutor {
  const cache = options.sqlCache ?? new Map<string, string>()
  const rewriters = options.rewriters ?? []
  const binders = options.binders ?? []
  const allowNamedWithoutBinder = options.allowNamedParamsWithoutBinder ?? false

  async function loadSql<P extends QueryParams, R>(
    spec: QuerySpec<P, R>
  ): Promise<string> {
    const cached = cache.get(spec.sqlFile)
    if (cached) {
      return cached
    }
    try {
      const sql = await options.loader.load(spec.sqlFile)
      cache.set(spec.sqlFile, sql)
      return sql
    } catch (cause) {
      throw new SQLLoaderError(
        `Failed to load SQL file "${spec.sqlFile}".`,
        spec.id,
        cause
      )
    }
  }

  function normalizeToQueryParams(
    value: unknown,
    specId: string
  ): QueryParams {
    if (Array.isArray(value)) {
      return value
    }
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>
    }
    throw new CatalogExecutionError(
      `Parameters must be positional or named (array or record).`,
      specId
    )
  }

  function applyRewriters<P extends QueryParams, R>(
    spec: QuerySpec<P, R>,
    sql: string,
    params: QueryParams,
    options?: unknown
  ): { sql: string; params: QueryParams } {
    let currentSql = sql
    let currentParams = params
    for (const rewriter of rewriters) {
      try {
        const rewritten = rewriter.rewrite({
          specId: spec.id,
          spec,
          sql: currentSql,
          params: currentParams,
          options,
        })
        currentSql = rewritten.sql
        currentParams = rewritten.params
      } catch (cause) {
        throw new RewriterError(
          `Rewriter "${rewriter.name}" failed for spec "${spec.id}".`,
          spec.id,
          cause
        )
      }
    }
    return {
      sql: currentSql,
      params: currentParams,
    }
  }

  function applyBinders<P extends QueryParams, R>(
    spec: QuerySpec<P, R>,
    sql: string,
    params: QueryParams
  ):
    | { binderUsed: false; sql: string; params: QueryParams }
    | { binderUsed: true; sql: string; params: unknown[] } {
    if (binders.length === 0) {
      return { binderUsed: false, sql, params }
    }
    let currentSql = sql
    let currentParams: QueryParams = params
    for (const binder of binders) {
      try {
        const bound = binder.bind({
          specId: spec.id,
          sql: currentSql,
          params: normalizeToQueryParams(currentParams, spec.id),
        })
        if (!Array.isArray(bound.params)) {
          throw new BinderError(
            `Binder "${binder.name}" returned invalid params for spec "${spec.id}".`,
            spec.id
          )
        }
        currentSql = bound.sql
        currentParams = bound.params
      } catch (cause) {
        if (cause instanceof CatalogError) {
          throw cause
        }
        throw new BinderError(
          `Binder "${binder.name}" failed for spec "${spec.id}".`,
          spec.id,
          cause
        )
      }
    }
    if (!Array.isArray(currentParams)) {
      throw new BinderError(
        `Binder chain did not produce positional params for spec "${spec.id}".`,
        spec.id
      )
    }
    return {
      binderUsed: true,
      sql: currentSql,
      params: currentParams,
    }
  }

  async function executeRows<P extends QueryParams, R>(
    spec: QuerySpec<P, R>,
    params: P,
    executionOptions?: unknown
  ): Promise<Row[]> {
    const validatedParams = assertParamsShape(
      spec.id,
      spec.params.shape,
      params
    )
    const sql = await loadSql(spec)
    const rewritten = applyRewriters(
      spec,
      sql,
      validatedParams,
      executionOptions
    )
    const rewrittenParams = assertParamsShape(
      spec.id,
      spec.params.shape,
      rewritten.params
    )
    assertNamedAllowed(spec, binders, allowNamedWithoutBinder)
    const bound = applyBinders(spec, rewritten.sql, rewrittenParams)
    try {
      return await options.executor(bound.sql, bound.params)
    } catch (cause) {
      throw new CatalogExecutionError(
        `Query executor failed while processing catalog spec "${spec.id}".`,
        spec.id,
        cause
      )
    }
  }

  function applyOutputTransformation<P extends QueryParams, R>(
    spec: QuerySpec<P, R>,
    rows: Row[]
  ): R[] {
    const mappedRows = spec.output.mapping
      ? mapRows(rows, spec.output.mapping)
      : (rows as unknown as R[])

    const decode = spec.output.validate
    if (!decode) {
      return mappedRows
    }

    // The decoder/validator is applied after mapping.
    return mappedRows.map((value) => decode(value))
  }

  function expectExactlyOneRow<R>(
    rows: R[],
    specId: string
  ): R {
    if (rows.length === 0) {
      throw new CatalogExecutionError(
        'Expected exactly one row but received none.',
        specId
      )
    }
    if (rows.length > 1) {
      throw new CatalogExecutionError(
        `Expected exactly one row but received ${rows.length}.`,
        specId
      )
    }
    return rows[0]
  }

  function extractScalar(rows: Row[], specId: string): unknown {
    const row = expectExactlyOneRow(rows, specId)
    const columns = Object.keys(row)
    if (columns.length !== 1) {
      throw new CatalogExecutionError(
        `Expected exactly one column but received ${columns.length}.`,
        specId
      )
    }
    return row[columns[0]]
  }

  function applyScalarResult<P extends QueryParams, R>(
    spec: QuerySpec<P, R>,
    value: unknown
  ): R {
    const decode = spec.output.validate
    if (decode) {
      // The decoder/validator runs against the extracted scalar value.
      return decode(value)
    }
    return value as R
  }

  return {
    async list<P extends QueryParams, R>(
      spec: QuerySpec<P, R>,
      params: P,
      options?: unknown
    ) {
      const rows = await executeRows(spec, params, options)
      return applyOutputTransformation(spec, rows)
    },
    async one<P extends QueryParams, R>(
      spec: QuerySpec<P, R>,
      params: P,
      options?: unknown
    ) {
      const rows = await executeRows(spec, params, options)
      const transformed = applyOutputTransformation(spec, rows)
      return expectExactlyOneRow(transformed, spec.id)
    },
    async scalar<P extends QueryParams, R>(
      spec: QuerySpec<P, R>,
      params: P,
      options?: unknown
    ) {
      const rows = await executeRows(spec, params, options)
      const value = extractScalar(rows, spec.id)
      return applyScalarResult(spec, value)
    },
  }
}

function assertNamedAllowed<P extends QueryParams, R>(
  spec: QuerySpec<P, R>,
  binders: Binder[],
  allow: boolean
): void {
  if (spec.params.shape === 'named' && binders.length === 0 && !allow) {
    throw new CatalogExecutionError(
      `Spec "${spec.id}" declares named parameters without a binder; enable allowNamedParamsWithoutBinder or add a binder.`,
      spec.id
    )
  }
}
