import type {
  CountableResult,
  TableRowsFixture,
  MissingFixtureStrategy,
} from '@rawsql-ts/testkit-core';
import type { SqlFormatterOptions, TableDefinitionModel } from 'rawsql-ts';
import type { DdlFixtureLoaderOptions } from '@rawsql-ts/testkit-core';

/** Generic record shape returned by testkit query results. */
export type Row = Record<string, unknown>;

/**
 * Executes raw SQL with normalized arguments and returns the driver rows.
 * @param sql - The SQL string to execute.
 * @param params - Parameter array aligned with the SQL placeholders.
 * @returns A promise resolving to the raw rows produced by the executor.
 */
export type QueryExecutor = (sql: string, params: readonly unknown[]) => Promise<Row[]>;

/**
 * Typed variant of `QueryExecutor` that preserves the caller-provided row shape.
 * @template RowType - The concrete shape of rows returned by the executor.
 * @param sql - SQL to execute.
 * @param params - Parameters supplied to the SQL statement.
 * @returns Resolved rows typed as `RowType[]`.
 */
export type TypedQueryExecutor<RowType extends Row = Row> = (
  sql: string,
  params: readonly unknown[]
) => Promise<RowType[]>;

/**
 * Input shape accepted by the Postgres testkit client when callers supply both SQL text and parameter arrays.
 */
export interface PostgresQueryInput {
  text: string;
  values?: unknown[];
  params?: unknown[];
}

/** Schema qualification options used when resolving table names and fixtures. */
export interface SchemaResolutionOptions {
  defaultSchema?: string;
  searchPath?: string[];
}

/**
 * Configuration for initializing a `PostgresTestkitClient`, including fixtures, formatter options, and executor wiring.
 * @template RowType - The row shape produced by the provided executor.
 * @property queryExecutor - The driver executor used to run rewritten SQL.
 * @property tableDefinitions - Optional table metadata that describes the schema.
 * @property tableRows - Optional fixture rows seeded for tests.
 * @property formatterOptions - SQL formatter tweaks that influence the rewritten queries.
 * @property missingFixtureStrategy - Strategy for resolving missing fixtures (error/skip).
 * @property ddl - DDL loader options used during schema resolution.
 * @property onExecute - Optional hook invoked when the client executes rewritten SQL.
 * @property disposeExecutor - Optional cleanup function called when the client closes.
 */
export interface CreatePostgresTestkitClientOptions<
  RowType extends Row = Row
> extends SchemaResolutionOptions {
  queryExecutor: TypedQueryExecutor<RowType>;
  tableDefinitions?: TableDefinitionModel[];
  tableRows?: TableRowsFixture[];
  formatterOptions?: SqlFormatterOptions;
  missingFixtureStrategy?: MissingFixtureStrategy;
  ddl?: DdlFixtureLoaderOptions;
  onExecute?: (sql: string, params?: unknown[], fixtures?: string[]) => void;
  disposeExecutor?: () => Promise<void> | void;
}

/** Fixture rows used to seed tables before running the rewrite pipeline. */
export type { TableRowsFixture } from '@rawsql-ts/testkit-core';

/** Table definition metadata reused by fixtures and the DDL loader. */
export type { TableDefinitionModel } from 'rawsql-ts';
