import type { SelectRewriterOptions, TableFixture } from '@rawsql-ts/testkit-core';

export interface SqliteStatementLike {
  all?(...params: unknown[]): unknown;
  get?(...params: unknown[]): unknown;
  run?(...params: unknown[]): unknown;
}

export interface SqliteConnectionLike {
  prepare?(sql: string, ...params: unknown[]): SqliteStatementLike;
  all?(sql: string, ...params: unknown[]): unknown;
  get?(sql: string, ...params: unknown[]): unknown;
  run?(sql: string, ...params: unknown[]): unknown;
  exec?(sql: string, ...params: unknown[]): unknown;
  pragma?(statement: string, ...params: unknown[]): unknown;
  close?(): void;
  [key: string]: unknown;
}

export interface SelectDriver<T = unknown> {
  query<U = T>(sql: string, params?: unknown[]): Promise<U[]>;
}

export interface CreateSqliteSelectTestDriverOptions extends SelectRewriterOptions {
  connectionFactory: () => SqliteConnectionLike;
}

export interface SqliteSelectTestDriver extends SelectDriver {
  withFixtures(fixtures: TableFixture[]): SqliteSelectTestDriver;
  close(): void;
}

export interface WrappedSqlQueryLogEntry {
  method: string;
  sql: string;
  params?: unknown;
}

export interface WrapSqliteDriverOptions extends SelectRewriterOptions {
  onExecute?(sql: string, params?: unknown): void;
  recordQueries?: boolean;
}

export type WrappedSqliteDriver<T> = T & {
  withFixtures(fixtures: TableFixture[]): WrappedSqliteDriver<T>;
  queries?: WrappedSqlQueryLogEntry[];
};
