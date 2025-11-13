import { SelectFixtureRewriter } from '@rawsql-ts/testkit-core';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import type { QueryResult } from 'pg';
import type {
  CreatePostgresSelectTestDriverOptions,
  PostgresConnectionLike,
  PostgresQueryParams,
  PostgresSelectTestDriver,
} from '../types';

export class PostgresSelectTestDriverImpl implements PostgresSelectTestDriver {
  private connection?: PostgresConnectionLike;
  private readonly rewriter: SelectFixtureRewriter;

  constructor(
    private readonly options: CreatePostgresSelectTestDriverOptions,
    private readonly scopedFixtures?: TableFixture[],
    seedConnection?: PostgresConnectionLike
  ) {
    this.rewriter = new SelectFixtureRewriter(options);
    this.connection = seedConnection;
  }

  public async query<T = unknown>(sql: string, params?: PostgresQueryParams): Promise<T[]> {
    // Build a rewrite context if scoped fixtures were supplied.
    const context = this.scopedFixtures ? { fixtures: this.scopedFixtures } : undefined;
    // Rewrite the incoming SQL so fixture-backed CTEs shadow the real tables.
    const rewritten = this.rewriter.rewrite(sql, context);

    // Execute the rewritten query via the configured connection and parameters.
    const result = await this.executeQuery<T>(rewritten.sql, params);
    return result.rows as T[];
  }

  public withFixtures(fixtures: TableFixture[]): PostgresSelectTestDriver {
    // Reuse any existing connection while swapping in the new fixtures.
    return new PostgresSelectTestDriverImpl(this.options, fixtures, this.connection);
  }

  public async close(): Promise<void> {
    if (!this.connection) {
      return;
    }

    // Dispose the underlying client, preferring end() but falling back to close().
    if (typeof this.connection.end === 'function') {
      await this.connection.end();
    } else if (typeof this.connection.close === 'function') {
      await this.connection.close();
    }

    this.connection = undefined;
  }

  private getConnection(): PostgresConnectionLike {
    if (!this.connection) {
      // Lazily materialize the connection so callers can provide suites with different factories.
      this.connection = this.options.connectionFactory();
    }
    return this.connection;
  }

  private async executeQuery<T>(sql: string, params?: PostgresQueryParams): Promise<QueryResult<T>> {
    const connection = this.getConnection();

    // Prefer the signature without parameters when no values were passed.
    if (!params || params.length === 0) {
      return connection.query(sql);
    }

    return connection.query(sql, params);
  }
}

export const createPostgresSelectTestDriver = (
  options: CreatePostgresSelectTestDriverOptions
): PostgresSelectTestDriver => {
  return new PostgresSelectTestDriverImpl(options);
};
