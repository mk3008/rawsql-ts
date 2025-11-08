import { SelectFixtureRewriter } from '@rawsql-ts/testkit-core';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import type {
  CreateSqliteSelectTestDriverOptions,
  SqliteConnectionLike,
  SqliteSelectTestDriver,
  SqliteStatementLike,
} from '../types';

export type QueryParams = unknown[] | Record<string, unknown> | undefined;

export class SqliteSelectTestDriverImpl implements SqliteSelectTestDriver {
  private connection?: SqliteConnectionLike;
  private readonly rewriter: SelectFixtureRewriter;

  constructor(
    private readonly options: CreateSqliteSelectTestDriverOptions,
    private readonly scopedFixtures?: TableFixture[],
    seedConnection?: SqliteConnectionLike
  ) {
    this.rewriter = new SelectFixtureRewriter(options);
    this.connection = seedConnection;
  }

  public async query<T = unknown>(sql: string, params?: QueryParams): Promise<T[]> {
    // Rewrite the incoming SQL so fixture-backed CTEs shadow physical tables.
    const context = this.scopedFixtures ? { fixtures: this.scopedFixtures } : undefined;
    const rewritten = this.rewriter.rewrite(sql, context);

    // Execute the rewritten SQL via the configured driver surface.
    const rows = this.execute(rewritten.sql, params);
    return Promise.resolve(rows as T[]);
  }

  public withFixtures(fixtures: TableFixture[]): SqliteSelectTestDriver {
    // Pass along the current connection so scoped drivers reuse the same DB handle.
    const next = new SqliteSelectTestDriverImpl(this.options, fixtures, this.connection);
    return next;
  }

  public close(): void {
    if (this.connection && typeof this.connection.close === 'function') {
      // Allow upstream driver to dispose any native handles.
      this.connection.close();
      this.connection = undefined;
    }
  }

  private getConnection(): SqliteConnectionLike {
    if (!this.connection) {
      // Lazily hydrate the driver so tests can swap factories per suite.
      this.connection = this.options.connectionFactory();
    }
    return this.connection;
  }

  private execute(sql: string, params?: QueryParams): unknown[] {
    const connection = this.getConnection();

    // Prefer prepared statements when the driver exposes them.
    if (typeof connection.prepare === 'function') {
      const statement = connection.prepare(sql);
      if (statement) {
        return this.runStatement(statement, params);
      }
    }

    // Fall back to high-level helpers such as db.all(sql, params).
    if (typeof connection.all === 'function') {
      const rows = this.invokeConnectionMethod(connection.all, connection, sql, params);
      return rows ?? [];
    }

    if (typeof connection.get === 'function') {
      const record = this.invokeConnectionMethod(connection.get, connection, sql, params);
      return record ? [record] : [];
    }

    if (typeof connection.run === 'function') {
      this.invokeConnectionMethod(connection.run, connection, sql, params);
      return [];
    }

    throw new Error('SQLite connection does not expose prepare/all/get/run methods.');
  }

  private runStatement(statement: SqliteStatementLike, params?: QueryParams): unknown[] {
    const args = this.normalizeParams(params);

    // Leverage the strongest method the statement exposes.
    if (typeof statement.all === 'function') {
      const rows = statement.all(...args);
      return rows ?? [];
    }

    if (typeof statement.get === 'function') {
      const record = statement.get(...args);
      return record ? [record] : [];
    }

    if (typeof statement.run === 'function') {
      statement.run(...args);
      return [];
    }

    throw new Error('Prepared statement does not expose all/get/run helpers.');
  }

  private invokeConnectionMethod<T>(
    method: (sql: string, ...args: unknown[]) => T,
    connection: SqliteConnectionLike,
    sql: string,
    params?: QueryParams
  ): T {
    // Normalize params once so every driver helper sees the same calling convention.
    const args = this.normalizeParams(params);
    if (args.length === 0) {
      return method.call(connection, sql);
    }
    return method.call(connection, sql, ...args);
  }

  private normalizeParams(params?: QueryParams): unknown[] {
    if (!params) {
      return [];
    }
    if (Array.isArray(params)) {
      return params;
    }
    return [params];
  }
}

/**
 * Instantiates a test driver that rewrites SELECT fixtures before delegating execution.
 * @param options Driver options that provide connection factory and rewrite settings.
 * @returns An implementation that exposes pg-style querying plus fixture scoping helpers.
 */
export const createSqliteSelectTestDriver = (
  options: CreateSqliteSelectTestDriverOptions
): SqliteSelectTestDriver => {
  return new SqliteSelectTestDriverImpl(options);
};
