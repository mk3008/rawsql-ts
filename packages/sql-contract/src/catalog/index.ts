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
    /**
     * Receives each mapped DTO for list()/one() after `output.mapping` runs,
     * or the extracted scalar value for scalar().
     */
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

export type ParamsShape = 'positional' | 'named' | 'unknown'

export interface ExecInput<P extends QueryParams = QueryParams> {
  specId: string
  sqlFile: string
  params: P
  options?: unknown
  execId: string
  attempt: number
}

export interface ExecOutput<R> {
  value: R
  rowCount?: number
}

export type ExecFn<P extends QueryParams = QueryParams, R = Row> = (
  input: ExecInput<P>
) => Promise<ExecOutput<R>>

export interface Extension {
  name: string
  wrap<P extends QueryParams, R>(next: ExecFn<P, R>): ExecFn<P, R>
}

export type QueryErrorKind = 'db' | 'contract' | 'unknown'

export interface ObservabilityEventBase {
  kind: 'query_start' | 'query_end' | 'query_error'
  specId: string
  sqlFile: string
  execId: string
  attempt: number
  timeMs: number
  attributes?: Record<string, string>
}

export interface QueryStartEvent extends ObservabilityEventBase {
  kind: 'query_start'
  sqlPreview: string
  paramsShape: ParamsShape
}

export interface QueryEndEvent extends ObservabilityEventBase {
  kind: 'query_end'
  rowCount: number
  durationMs: number
}

export interface QueryErrorEvent extends ObservabilityEventBase {
  kind: 'query_error'
  durationMs: number
  errorKind: QueryErrorKind
  errorMessage: string
}

export type ObservabilityEvent =
  | QueryStartEvent
  | QueryEndEvent
  | QueryErrorEvent

export interface ObservabilitySink {
  emit(event: ObservabilityEvent): void
}

type ExecutionSnapshot = {
  sql: string
  params: QueryParams
  paramsShape: ParamsShape
  startTime: number
}

let execIdCounter = 0
function createExecId(): string {
  execIdCounter += 1
  return `catalog-exec-${Date.now()}-${execIdCounter}`
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

/** Wraps failures encountered while loading catalog SQL assets. */
export class SQLLoaderError extends CatalogError {}
/** Wraps failures thrown by catalog rewriters. */
export class RewriterError extends CatalogError {}
/** Wraps binder failures or invalid binder output. */
export class BinderError extends CatalogError {}
/** Captures violations of the declared query/catalog contract before hitting the executor. */
export class ContractViolationError extends CatalogError {}
/** Wraps failures from the query executor or result shaping.
 * Contract violations must throw `ContractViolationError` instead so observability
 * can consistently classify them as `contract`.
 */
export class CatalogExecutionError extends CatalogError {}

function assertPositionalParams(
  specId: string,
  params: unknown
): unknown[] {
  if (!Array.isArray(params)) {
    throw new ContractViolationError(
      `Spec "${specId}" expects positional parameters.`,
      specId
    )
  }
  return params
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  // Accept `{}`-like objects and those created via Object.create(null).
  return proto === Object.prototype || proto === null
}

function assertNamedParams(
  specId: string,
  params: unknown
): Record<string, unknown> {
  if (!isPlainObject(params)) {
    throw new ContractViolationError(
      `Spec "${specId}" expects named parameters.`,
      specId
    )
  }
  return params
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
  extensions?: Extension[]
  observabilitySink?: ObservabilitySink
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
  const extensions = options.extensions ?? []
  const sink = options.observabilitySink

  async function loadSql<P extends QueryParams, R>(
    spec: QuerySpec<P, R>
  ): Promise<string> {
    const cached = cache.get(spec.sqlFile)
    if (cached !== undefined) {
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
    if (isPlainObject(value)) {
      return value
    }
    throw new ContractViolationError(
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

  function describeParamsShape(params: QueryParams): ParamsShape {
    if (Array.isArray(params)) {
      return 'positional'
    }
    if (isPlainObject(params)) {
      return 'named'
    }
    return 'unknown'
  }

  function createSqlPreview(sql: string): string {
    const maxLength = 2_048
    return sql.length <= maxLength ? sql : sql.slice(0, maxLength)
  }

  function getErrorKind(error: unknown): QueryErrorKind {
    if (error instanceof CatalogExecutionError) {
      return 'db'
    }
    if (error instanceof CatalogError) {
      return 'contract'
    }
    return 'unknown'
  }

  function emitQueryStartEvent(
    spec: QuerySpec<any, any>,
    execId: string,
    attempt: number,
    snapshot: ExecutionSnapshot
  ): void {
    if (!sink) {
      return
    }
    sink.emit({
      kind: 'query_start',
      specId: spec.id,
      sqlFile: spec.sqlFile,
      execId,
      attempt,
      timeMs: snapshot.startTime,
      attributes: spec.tags,
      sqlPreview: createSqlPreview(snapshot.sql),
      paramsShape: snapshot.paramsShape,
    })
  }

  function emitQueryEndEvent(
    spec: QuerySpec<any, any>,
    execId: string,
    attempt: number,
    baseStartTime: number,
    rowCount: number
  ): void {
    if (!sink) {
      return
    }
    const now = Date.now()
    sink.emit({
      kind: 'query_end',
      specId: spec.id,
      sqlFile: spec.sqlFile,
      execId,
      attempt,
      timeMs: now,
      attributes: spec.tags,
      durationMs: Math.max(now - baseStartTime, 0),
      rowCount,
    })
  }

  function emitQueryErrorEvent(
    spec: QuerySpec<any, any>,
    execId: string,
    attempt: number,
    baseStartTime: number,
    error: unknown
  ): void {
    if (!sink) {
      return
    }
    const now = Date.now()
    sink.emit({
      kind: 'query_error',
      specId: spec.id,
      sqlFile: spec.sqlFile,
      execId,
      attempt,
      timeMs: now,
      attributes: spec.tags,
      durationMs: Math.max(now - baseStartTime, 0),
      errorKind: getErrorKind(error),
      errorMessage:
        error instanceof Error ? error.message : String(error ?? 'unknown'),
    })
  }

  async function executeRows<P extends QueryParams, R>(
    spec: QuerySpec<P, R>,
    params: P,
    executionOptions: unknown,
    execId: string,
    attempt: number
  ): Promise<{ rows: Row[]; snapshot?: ExecutionSnapshot }> {
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
    const paramsShape = describeParamsShape(bound.params)
    const snapshot: ExecutionSnapshot = {
      sql: bound.sql,
      params: bound.params,
      paramsShape,
      startTime: Date.now(),
    }
    emitQueryStartEvent(spec, execId, attempt, snapshot)
    try {
      const rows = await options.executor(bound.sql, bound.params)
      return { rows, snapshot }
    } catch (cause) {
      throw new CatalogExecutionError(
        `Query executor failed while processing catalog spec "${spec.id}".`,
        spec.id,
        cause
      )
    }
  }

  function createPipelineExec<P extends QueryParams, R, Result>(
    spec: QuerySpec<P, R>,
    finalize: (rows: Row[]) => Result
  ): ExecFn<P, Result> {
    return async (input) => {
      const invocationStart = Date.now()
      let snapshot: ExecutionSnapshot | undefined
      try {
        const { rows, snapshot: rowSnapshot } = await executeRows(
          spec,
          input.params,
          input.options,
          input.execId,
          input.attempt
        )
        snapshot = rowSnapshot
        const value = finalize(rows)
        const durationBase = snapshot?.startTime ?? invocationStart
        // durationMs reflects the executor round-trip after loading/rewriting/binding SQL.
        emitQueryEndEvent(
          spec,
          input.execId,
          input.attempt,
          durationBase,
          rows.length
        )
        return { value, rowCount: rows.length }
      } catch (error) {
        const durationBase = snapshot?.startTime ?? invocationStart
        emitQueryErrorEvent(
          spec,
          input.execId,
          input.attempt,
          durationBase,
          error
        )
        throw error
      }
    }
  }

  function wrapWithExtensions<P extends QueryParams, R>(
    core: ExecFn<P, R>
  ): ExecFn<P, R> {
    return extensions.reduceRight(
      (next, extension) => extension.wrap(next),
      core
    )
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

    // The decoder/validator runs after mapping so it receives the DTO shape
    // declared by the catalog contract instead of the raw SQL row.
    return mappedRows.map((value) => decode(value))
  }

  function expectExactlyOneRow<R>(
    rows: R[],
    specId: string
  ): R {
    if (rows.length === 0) {
      throw new ContractViolationError(
        'Expected exactly one row but received none.',
        specId
      )
    }
    if (rows.length > 1) {
      throw new ContractViolationError(
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
      throw new ContractViolationError(
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
      // Scalar contracts validate the extracted single-column value directly.
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
      const exec = wrapWithExtensions(
        createPipelineExec(spec, (rows) => applyOutputTransformation(spec, rows))
      )
      const execId = createExecId()
      const attempt = 1
      const result = await exec({
        specId: spec.id,
        sqlFile: spec.sqlFile,
        params,
        options,
        execId,
        attempt,
      })
      return result.value
    },
    async one<P extends QueryParams, R>(
      spec: QuerySpec<P, R>,
      params: P,
      options?: unknown
    ) {
      const exec = wrapWithExtensions(
        createPipelineExec(
          spec,
          (rows) =>
            expectExactlyOneRow(
              applyOutputTransformation(spec, rows),
              spec.id
            )
        )
      )
      const execId = createExecId()
      const attempt = 1
      const result = await exec({
        specId: spec.id,
        sqlFile: spec.sqlFile,
        params,
        options,
        execId,
        attempt,
      })
      return result.value
    },
    async scalar<P extends QueryParams, R>(
      spec: QuerySpec<P, R>,
      params: P,
      options?: unknown
    ) {
      const exec = wrapWithExtensions(
        createPipelineExec(spec, (rows) => {
          const value = extractScalar(rows, spec.id)
          return applyScalarResult(spec, value)
        })
      )
      const execId = createExecId()
      const attempt = 1
      const result = await exec({
        specId: spec.id,
        sqlFile: spec.sqlFile,
        params,
        options,
        execId,
        attempt,
      })
      return result.value
    },
  }
}

/** Named parameters are forbidden unless a binder is configured or explicit allowance is granted. */
function assertNamedAllowed<P extends QueryParams, R>(
  spec: QuerySpec<P, R>,
  binders: Binder[],
  allow: boolean
): void {
  if (spec.params.shape === 'named' && binders.length === 0 && !allow) {
    throw new ContractViolationError(
      `Spec "${spec.id}" declares named parameters without a binder; enable allowNamedParamsWithoutBinder or add a binder.`,
      spec.id
    )
  }
}
