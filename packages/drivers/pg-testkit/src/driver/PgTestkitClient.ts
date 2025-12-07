import type { QueryResult, QueryResultRow } from 'pg';
import {
  DefaultFixtureProvider,
  ResultSelectRewriter,
  TableNameResolver,
  alignRewrittenParameters,
  applyCountWrapper,
} from '@rawsql-ts/testkit-core';
import type {
  CreatePgTestkitClientOptions,
  PgQueryInput,
  PgQueryable,
  TableRowsFixture,
} from '../types';
import { validateFixtureRowsAgainstTableDefinitions } from '../utils/fixtureValidation';
import { resolveFixtureState } from '../utils/fixtureState';

/**
 * Lightweight client that rewrites CRUD/SELECT statements into fixture-backed SELECTs
 * and delegates execution to a real `pg` connection.
 *
 * Consumers can use this in place of `pg.Client` during tests; production code can stay
 * unaware of pg-testkit as long as it relies on the standard `query` API.
 */
export class PgTestkitClient {
  private connection?: PgQueryable;
  private readonly rewriter: ResultSelectRewriter;
  private readonly tableNameResolver: TableNameResolver;

  constructor(
    private readonly options: CreatePgTestkitClientOptions,
    private readonly scopedRows?: TableRowsFixture[],
    seedConnection?: PgQueryable
  ) {
    // Keep a resolver around so every fixture/DDL lookup uses the same schema rules.
    this.tableNameResolver = new TableNameResolver({
      defaultSchema: options.defaultSchema,
      searchPath: options.searchPath,
    });
    // Align DDL metadata and explicit overrides under the shared resolver rules.
    const fixturesState = resolveFixtureState(
      {
        ddl: options.ddl,
        tableDefinitions: options.tableDefinitions,
        tableRows: options.tableRows,
      },
      this.tableNameResolver
    );

    // Combine the base and scoped fixtures so they are validated exactly once through the resolver.
    const mergedTableRows = [...(options.tableRows ?? []), ...(scopedRows ?? [])];
    validateFixtureRowsAgainstTableDefinitions(
      mergedTableRows,
      fixturesState.tableDefinitions,
      'tableRows',
      this.tableNameResolver
    );

    const fixtureStore = new DefaultFixtureProvider(
      fixturesState.tableDefinitions,
      fixturesState.tableRows,
      this.tableNameResolver
    );
    this.rewriter = new ResultSelectRewriter(
      fixtureStore,
      options.missingFixtureStrategy ?? 'error',
      options.formatterOptions,
      this.tableNameResolver
    );
    this.connection = seedConnection;
  }

  /**
   * Executes SQL after rewriting it to use fixture-backed CTEs. CRUD statements are converted
   * to result-producing SELECTs; unsupported DDL is ignored.
   *
   * @param textOrConfig SQL text or pg QueryConfig
   * @param values Optional positional parameters
   * @returns pg-style QueryResult with rows simulated from fixtures
   */
  public async query<T extends QueryResultRow = QueryResultRow>(
    textOrConfig: PgQueryInput,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    const sql = typeof textOrConfig === 'string' ? textOrConfig : textOrConfig.text;
    if (!sql) {
      throw new Error('Query text is required for pg-testkit execution.');
    }

    // Rewrite CRUD and SELECT statements into fixture-backed SELECT queries.
    const rewritten = this.rewriter.rewrite(sql, this.scopedRows);
    if (!rewritten.sql) {
      return this.buildEmptyResult<T>('NOOP');
    }

    // Align caller-supplied parameters with the rewritten placeholders to keep numbering contiguous.
    const incomingParams =
      typeof textOrConfig === 'string'
        ? values
        : values ??
          (textOrConfig as { values?: unknown[]; params?: unknown[] }).values ??
          (textOrConfig as { values?: unknown[]; params?: unknown[] }).params;

    const normalizeResult = alignRewrittenParameters(rewritten.sql, incomingParams);
    const payload =
      typeof textOrConfig === 'string'
        ? normalizeResult.sql
        : { ...textOrConfig, text: normalizeResult.sql, values: normalizeResult.params };
    const connection = await this.getConnection();

    this.options.onExecute?.(normalizeResult.sql, normalizeResult.params, rewritten.fixturesApplied);

    const rawResult = typeof payload === 'string'
      ? await connection.query<T>(payload, normalizeResult.params)
      : await connection.query<T>(payload);

    return applyCountWrapper(rawResult, rewritten.sourceCommand, rewritten.isCountWrapper);
  }

  /**
   * Derives a scoped client that overlays additional fixtures while reusing the same connection.
   */
  public withFixtures(fixtures: TableRowsFixture[]): PgTestkitClient {
    return new PgTestkitClient(this.options, fixtures, this.connection);
  }

  /**
   * Disposes the underlying connection or returns it to the pool if `release` is available.
   */
  public async close(): Promise<void> {
    if (!this.connection) {
      return;
    }

    const closable = this.connection;
    this.connection = undefined;

    if (typeof closable.release === 'function') {
      closable.release();
      return;
    }

    if (typeof closable.end === 'function') {
      await closable.end();
    }
  }

  private async getConnection(): Promise<PgQueryable> {
    if (this.connection) {
      return this.connection;
    }

    this.connection = await this.options.connectionFactory();
    return this.connection;
  }

  private buildEmptyResult<T extends QueryResultRow>(command: string): QueryResult<T> {
    return {
      command,
      rowCount: 0,
      oid: 0,
      rows: [],
      fields: [],
    };
  }

}

/** Factory that instantiates a `PgTestkitClient` with the provided fixture-driven options. */
export const createPgTestkitClient = (options: CreatePgTestkitClientOptions): PgTestkitClient => {
  return new PgTestkitClient(options);
};
