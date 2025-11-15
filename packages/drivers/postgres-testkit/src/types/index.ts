import type { QueryConfig, QueryResult, QueryResultRow } from 'pg';
import type {
  SelectRewriterOptions,
  TableDef,
  TestkitCudOptions,
  TableFixture,
} from '@rawsql-ts/testkit-core';

export interface SelectDriver<T = unknown> {
  query<U = T>(sql: string, params?: unknown[]): Promise<U[]>;
}

export type PostgresQueryParams = unknown[] | undefined;

export type PostgresQueryCallback<T extends QueryResultRow = QueryResultRow> = (
  error: Error | null,
  result: QueryResult<T>
) => void;

export interface PostgresConnectionLike {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    callback?: PostgresQueryCallback<T>
  ): Promise<QueryResult<T>>;
  query<T extends QueryResultRow = QueryResultRow>(
    config: QueryConfig<T>,
    callback?: PostgresQueryCallback<T>
  ): Promise<QueryResult<T>>;
  end?(): Promise<void>;
  close?(): Promise<void>;
}

export interface CreatePostgresSelectTestDriverOptions extends SelectRewriterOptions {
  connectionFactory: () => PostgresConnectionLike;
}

export interface PostgresSelectTestDriver extends SelectDriver {
  withFixtures(fixtures: TableFixture[]): PostgresSelectTestDriver;
  close(): Promise<void>;
}

export interface WrappedPostgresQueryLogEntry {
  method: string;
  sql: string;
  params?: unknown;
}

export interface WrapPostgresDriverOptions extends SelectRewriterOptions {
  onExecute?(sql: string, params?: unknown): void;
  recordQueries?: boolean;
  tableDefs?: TableDef[];
  cudOptions?: TestkitCudOptions;
}

export type WrappedPostgresDriver<T> = T & {
  withFixtures(fixtures: TableFixture[]): WrappedPostgresDriver<T>;
  queries?: WrappedPostgresQueryLogEntry[];
};
