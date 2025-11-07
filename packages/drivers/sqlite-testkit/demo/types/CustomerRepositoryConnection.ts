import type { SqliteConnectionLike, SqliteStatementLike } from '../../src/types';

export interface CustomerRepositoryStatement extends SqliteStatementLike {
  all(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
}

export interface CustomerRepositoryConnection extends SqliteConnectionLike {
  prepare(sql: string, ...params: unknown[]): CustomerRepositoryStatement;
  close(): void;
}
