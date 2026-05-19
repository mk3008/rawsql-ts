import type { CountableResult } from '@rawsql-ts/testkit-core';
import {
  DefaultFixtureProvider,
  ResultSelectRewriter,
  TableNameResolver,
  alignRewrittenParameters,
  applyCountWrapper,
} from '@rawsql-ts/testkit-core';
import type { TableRowsFixture } from '@rawsql-ts/testkit-core';
import { resolveFixtureState } from '../utils/fixtureState';
import { validateFixtureRowsAgainstTableDefinitions } from '../utils/fixtureValidation';
import type {
  CreatePostgresTestkitClientOptions,
  PostgresQueryInput,
  QueryExecutor,
  Row,
  TypedQueryExecutor,
} from '../types';

type NormalizedExecutionResult = {
  rows: Row[];
  rowCount?: number;
};

function toPreview(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    if (serialized) {
      return serialized.length > 180
        ? `${serialized.slice(0, 180)}...`
        : serialized;
    }
  } catch {
    // JSON.stringify can fail on circular values; fall back to String below.
  }

  const fallback = String(value);
  return fallback.length > 180 ? `${fallback.slice(0, 180)}...` : fallback;
}

function normalizeExecutionResult(value: unknown): NormalizedExecutionResult {
  if (Array.isArray(value)) {
    return { rows: value as Row[] };
  }

  if (value && typeof value === 'object' && 'rows' in value) {
    const rows = (value as { rows: unknown }).rows;
    const rowCount = (value as { rowCount?: unknown }).rowCount;

    if (!Array.isArray(rows)) {
      throw new Error(
        `normalizeExecutionResult expected "rows" to be an array, received ${typeof rows}. preview=${toPreview(rows)}`
      );
    }

    if (rowCount !== undefined && typeof rowCount !== 'number') {
      throw new Error(
        `normalizeExecutionResult expected "rowCount" to be a number when present, received ${typeof rowCount}. preview=${toPreview(rowCount)}`
      );
    }

    return {
      rows: rows as Row[],
      rowCount,
    };
  }

  throw new Error(
    `normalizeExecutionResult expected an array or { rows, rowCount? } object, received ${typeof value}. preview=${toPreview(value)}`
  );
}

interface ExecutionContext<RowType extends Row> {
  executor: TypedQueryExecutor<RowType>;
  disposeExecutor?: () => Promise<void> | void;
  closed: boolean;
}

/** The driver-agnostic Postgres testkit client that rewrites SQL using fixtures and delegates to a QueryExecutor. */
export class PostgresTestkitClient<RowType extends Row = Row> {
  private readonly tableNameResolver: TableNameResolver;
  private readonly rewriter: ResultSelectRewriter;
  private readonly fixtureStore: DefaultFixtureProvider;
  private readonly context: ExecutionContext<RowType>;
  private readonly scopedRows?: TableRowsFixture[];

  constructor(
    private readonly options: CreatePostgresTestkitClientOptions<RowType>,
    scopedRows?: TableRowsFixture[],
    context?: ExecutionContext<RowType>
  ) {
    this.tableNameResolver = new TableNameResolver({
      defaultSchema: options.defaultSchema,
      searchPath: options.searchPath,
    });
    const fixturesState = resolveFixtureState(
      {
        generated: options.generated,
        ddl: options.ddl,
        tableDefinitions: options.tableDefinitions,
        tableRows: options.tableRows,
      },
      this.tableNameResolver
    );

    const mergedTableRows = [...(options.tableRows ?? []), ...(scopedRows ?? [])];
    validateFixtureRowsAgainstTableDefinitions(
      mergedTableRows,
      fixturesState.tableDefinitions,
      'tableRows',
      this.tableNameResolver
    );

    this.fixtureStore = new DefaultFixtureProvider(
      fixturesState.tableDefinitions,
      fixturesState.tableRows,
      this.tableNameResolver
    );
    this.rewriter = new ResultSelectRewriter(
      this.fixtureStore,
      options.missingFixtureStrategy ?? 'error',
      options.formatterOptions,
      this.tableNameResolver,
      fixturesState.viewDefinitions
    );
    this.scopedRows = scopedRows;
    this.context = context ?? {
      executor: options.queryExecutor,
      disposeExecutor: options.disposeExecutor,
      closed: false,
    };
  }

  public async query(
    textOrConfig: string | PostgresQueryInput,
    values?: unknown[]
  ): Promise<CountableResult<RowType>> {
    const sql = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
    if (!sql) {
      throw new Error('Query text is required for Postgres testkit execution.');
    }

    const rewritten = this.rewriter.rewrite(sql, this.scopedRows);
    if (!rewritten.sql) {
      return this.buildEmptyResult<RowType>('NOOP');
    }

    const incomingParams =
      typeof textOrConfig === 'string'
        ? values
        : values ?? textOrConfig.values ?? textOrConfig.params;

    const normalizedResult = alignRewrittenParameters(rewritten.sql, incomingParams);
    const payloadSql = normalizedResult.sql;
    const payloadParams = normalizedResult.params;

    this.options.onExecute?.(payloadSql, payloadParams, rewritten.fixturesApplied);

    const rawResult = await this.context.executor(payloadSql, payloadParams ?? []);
    const normalizedExecution = normalizeExecutionResult(rawResult);
    const rows = normalizedExecution.rows as RowType[];
    const fields =
      rows.length > 0
        ? Object.keys(rows[0]).map((name) => ({ name }))
        : [];
    let result: CountableResult<RowType> = {
      command: rewritten.sourceCommand ?? 'select',
      rowCount: normalizedExecution.rowCount ?? rows.length,
      rows,
      fields,
    };
    result = applyCountWrapper(result, rewritten.sourceCommand, rewritten.isCountWrapper);
    if (rewritten.isCountWrapper && rows.length > 0) {
      const firstRow = rows[0];
      const countValue = Array.isArray(firstRow)
        ? firstRow[0]
        : (firstRow as Record<string, unknown>)['count'];
      const numericCount =
        typeof countValue === 'string' ? Number(countValue) : Number(countValue ?? 0);
      if (!Number.isNaN(numericCount)) {
        result.rowCount = numericCount;
        result.command = rewritten.sourceCommand ?? result.command;
      }
    }
    return result;
  }

  public withFixtures(fixtures: TableRowsFixture[]): PostgresTestkitClient<RowType> {
    return new PostgresTestkitClient<RowType>(this.options, fixtures, this.context);
  }

  public async close(): Promise<void> {
    if (this.context.closed) {
      return;
    }
    this.context.closed = true;
    await this.context.disposeExecutor?.();
  }

  private buildEmptyResult<RowType extends Row>(command: string): CountableResult<RowType> {
    return {
      command,
      rowCount: 0,
      fields: [],
      rows: [],
    };
  }
}

/**
 * Create a `PostgresTestkitClient` that rewrites SQL using the provided fixtures before delegating to the executor.
 * @template RowType - The shape of rows returned by the query executor.
 * @param options - Fixture definitions, table rows, formatter settings, and the executor used by the adapter.
 * @returns A configured `PostgresTestkitClient`.
 */
export const createPostgresTestkitClient = <RowType extends Row>(
  options: CreatePostgresTestkitClientOptions<RowType>
): PostgresTestkitClient<RowType> => {
  return new PostgresTestkitClient<RowType>(options);
};


