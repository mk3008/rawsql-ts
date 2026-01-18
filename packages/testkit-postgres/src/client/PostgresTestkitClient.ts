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
      this.tableNameResolver
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

    const rawRows = await this.context.executor(payloadSql, payloadParams ?? []);
    const fields =
      rawRows.length > 0
        ? Object.keys(rawRows[0]).map((name) => ({ name }))
        : [];
    let result: CountableResult<RowType> = {
      command: rewritten.sourceCommand ?? 'select',
      rowCount: rawRows.length,
      rows: rawRows,
      fields,
    };
    result = applyCountWrapper(result, rewritten.sourceCommand, rewritten.isCountWrapper);
    if (rewritten.isCountWrapper && rawRows.length > 0) {
      const firstRow = rawRows[0];
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
