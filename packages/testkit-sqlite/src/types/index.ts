import type { SelectRewriterOptions } from '@rawsql-ts/testkit-core';
import type { TableFixture } from '@rawsql-ts/testkit-core';

export interface SqliteStatementLike {
  all?(...params: unknown[]): unknown[] | undefined;
  get?(...params: unknown[]): unknown;
  run?(...params: unknown[]): unknown;
}

export interface SqliteConnectionLike {
  prepare?(sql: string, ...params: unknown[]): SqliteStatementLike;
  all?(sql: string, ...params: unknown[]): unknown[] | undefined;
  get?(sql: string, ...params: unknown[]): unknown;
  run?(sql: string, ...params: unknown[]): unknown;
  exec?(sql: string, ...params: unknown[]): unknown;
  pragma?(statement: string, ...params: unknown[]): unknown;
  close?(): void;
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
  fixtures?: string[];
}

export interface WrapSqliteDriverOptions extends SelectRewriterOptions {
  onExecute?(sql: string, params?: unknown): void;
  recordQueries?: boolean;
}

export type WrappedSqliteDriver<T> = T & {
  withFixtures(fixtures: TableFixture[]): WrappedSqliteDriver<T>;
  queries?: WrappedSqlQueryLogEntry[];
};
