import type { QueryResult, QueryResultRow } from 'pg';
import { PgFixtureStore } from '../fixtures/PgFixtureStore';
import { PgResultSelectRewriter } from '../rewriter/PgResultSelectRewriter';
import type {
  CreatePgTestkitClientOptions,
  PgFixture,
  PgQueryInput,
  PgQueryable,
} from '../types';

/**
 * Lightweight client that rewrites CRUD/SELECT statements into fixture-backed SELECTs
 * and delegates execution to a real `pg` connection.
 *
 * Consumers can use this in place of `pg.Client` during tests; production code can stay
 * unaware of pg-testkit as long as it relies on the standard `query` API.
 */
export class PgTestkitClient {
  private connection?: PgQueryable;
  private readonly rewriter: PgResultSelectRewriter;

  constructor(
    private readonly options: CreatePgTestkitClientOptions,
    private readonly scopedFixtures?: PgFixture[],
    seedConnection?: PgQueryable
  ) {
    const fixtureStore = new PgFixtureStore(options.fixtures ?? []);
    this.rewriter = new PgResultSelectRewriter(
      fixtureStore,
      options.missingFixtureStrategy ?? 'error',
      options.formatterOptions
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
    const rewritten = this.rewriter.rewrite(sql, this.scopedFixtures);
    if (!rewritten.sql) {
      return this.buildEmptyResult<T>('NOOP');
    }

    const payload = typeof textOrConfig === 'string' ? rewritten.sql : { ...textOrConfig, text: rewritten.sql };
    const connection = await this.getConnection();
    const params = typeof textOrConfig === 'string' ? values : textOrConfig.values;

    // Surface the post-rewrite SQL so callers can log or assert against it.
    this.options.onExecute?.(rewritten.sql, params, rewritten.fixturesApplied);

    if (typeof payload === 'string') {
      return connection.query<T>(payload, values);
    }

    return connection.query<T>(payload);
  }

  /**
   * Derives a scoped client that overlays additional fixtures while reusing the same connection.
   */
  public withFixtures(fixtures: PgFixture[]): PgTestkitClient {
    // Reuse the same connection so scoped drivers stay lightweight.
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

    // Prefer release() for pooled clients; fall back to end() when available.
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

    // Lazily hydrate the connection so tests can swap factories per suite.
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
