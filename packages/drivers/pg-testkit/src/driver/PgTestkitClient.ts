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
    const sourceCommand = this.extractSqlCommand(sql);

    // Rewrite CRUD and SELECT statements into fixture-backed SELECT queries.
    const rewritten = this.rewriter.rewrite(sql, this.scopedFixtures);
    if (!rewritten.sql) {
      return this.buildEmptyResult<T>('NOOP');
    }

    const incomingParams =
      typeof textOrConfig === 'string'
        ? values
        : (textOrConfig as { values?: unknown[]; params?: unknown[] }).values ??
          (textOrConfig as { values?: unknown[]; params?: unknown[] }).params;

    const normalizeResult = this.alignRewrittenParameters(rewritten.sql, incomingParams);
    const payload =
      typeof textOrConfig === 'string'
        ? normalizeResult.sql
        : { ...textOrConfig, text: normalizeResult.sql, values: normalizeResult.params };
    const connection = await this.getConnection();

    // Surface the post-rewrite SQL so callers can log or assert against it.
    console.log('pg-testkit sql ->', normalizeResult.sql);
    this.options.onExecute?.(normalizeResult.sql, normalizeResult.params, rewritten.fixturesApplied);

    const rawResult = typeof payload === 'string'
      ? await connection.query<T>(payload, normalizeResult.params)
      : await connection.query<T>(payload);

    const countValue = this.extractCountValue(rawResult);
    if (countValue !== null && sourceCommand && this.isCrudCommand(sourceCommand)) {
      // Treat fixture-driven CRUD rewrites as their original command so Prisma trusts the derived row count.
      rawResult.rowCount = countValue;
      rawResult.command = sourceCommand.toUpperCase() as typeof rawResult.command;
    }

    return this.normalizeRowCount(rawResult);
  }

  private alignRewrittenParameters(sql: string, params?: unknown[]): { sql: string; params?: unknown[] } {
    if (!params || params.length === 0) {
      return { sql, params };
    }

    const matches = Array.from(sql.matchAll(/\$(\d+)/g));
    if (matches.length === 0) {
      return { sql, params: [] };
    }

    const placeholderSet = new Map<number, number>();
    const orderedIndexes = [...new Set(matches.map((match) => Number(match[1])))].sort((a, b) => a - b);
    orderedIndexes.forEach((index, idx) => {
      placeholderSet.set(index, idx + 1);
    });

    const alignedSql = [...placeholderSet.entries()]
      .sort((a, b) => b[0] - a[0])
      .reduce((acc, [original, mapped]) => acc.split(`$${original}`).join(`$${mapped}`), sql);

    const alignedValues = [...placeholderSet.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([original]) => params[original - 1]);

    return { sql: alignedSql, params: alignedValues };
  }

  private normalizeRowCount<T extends QueryResultRow>(result: QueryResult<T>): QueryResult<T> {
    if ((result.command ?? '').toUpperCase() !== 'SELECT' || result.rows.length !== 1) {
      return result;
    }

    const [field] = result.fields ?? [];
    if (!field || field.name !== 'count') {
      return result;
    }

    const countValue = (result.rows[0] as Record<string, unknown>)['count'];
    const numericCount = typeof countValue === 'string' ? Number(countValue) : Number(countValue ?? 0);
    if (Number.isNaN(numericCount)) {
      return result;
    }

    return { ...result, rowCount: numericCount };
  }

  private extractCountValue<T extends QueryResultRow>(result: QueryResult<T>): number | null {
    if ((result.command ?? '').toUpperCase() !== 'SELECT') {
      return null;
    }

    const [field] = result.fields ?? [];
    if (!field || field.name !== 'count' || result.rows.length !== 1) {
      return null;
    }

    const row = result.rows[0];
    const value = Array.isArray(row)
      ? row[0]
      : (row as Record<string, unknown>)[field.name];

    const numericCount = typeof value === 'string' ? Number(value) : Number(value ?? 0);
    return Number.isNaN(numericCount) ? null : numericCount;
  }

  private isCrudCommand(command: string): boolean {
    return ['INSERT', 'UPDATE', 'DELETE', 'MERGE'].includes(command.toUpperCase());
  }

  private extractSqlCommand(sql: string): string | null {
    const trimmed = sql.trimStart();
    if (!trimmed) {
      return null;
    }

    const firstWordMatch = trimmed.match(/^([A-Za-z]+)/);
    if (!firstWordMatch) {
      return null;
    }

    const firstWord = firstWordMatch[1].toUpperCase();
    if (firstWord === 'WITH') {
      const remaining = trimmed.slice(firstWordMatch[0].length).trimStart();
      const nextMatch = remaining.match(/^([A-Za-z]+)/);
      return nextMatch ? nextMatch[1].toUpperCase() : null;
    }

    return firstWord;
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
