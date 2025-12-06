import type { QueryConfig, QueryResult, QueryResultRow } from 'pg';
import type {
  FixtureTableDefinition,
  MissingFixtureStrategy,
  SqlFormatterOptions,
  TableDefinitionModel,
  TableDefinitionRegistry,
} from 'rawsql-ts';
export type { TableDefinitionModel } from 'rawsql-ts';
import type { TableRowsFixture } from '@rawsql-ts/testkit-core';
import type { DdlFixtureLoaderOptions } from '@rawsql-ts/testkit-core';

interface SchemaResolutionOptions {
  defaultSchema?: string;
  searchPath?: string[];
}

/** Rows-only fixtures authored by pg-testkit consumers. */
export type PgTableRowsFixture = TableRowsFixture;

/** Table definitions shared across testkits and derived from DDL. */
export type PgTableDefinition = TableDefinitionModel;

/** Snapshot returned after fixture resolution, containing the tables, resolver-generated registry, and the applied fixture names. */
export interface PgFixtureSnapshot {
  fixtureTables: FixtureTableDefinition[];
  tableDefinitions: TableDefinitionRegistry;
  fixturesApplied: string[];
}

/** Resolves fixture overrides and exposes the most recently applied snapshot. */
export interface PgFixtureProvider {
  resolve(overrides?: TableRowsFixture[]): PgFixtureSnapshot;
}

/** Input accepted by driver query helpers (raw SQL or pg `QueryConfig`). */
export type PgQueryInput = string | QueryConfig<unknown[]>;

/** Represents a Postgres client that can execute queries during testing. */
export interface PgQueryable {
  query<T extends QueryResultRow = QueryResultRow>(
    queryTextOrConfig: PgQueryInput,
    values?: unknown[]
  ): Promise<QueryResult<T>>;
  end?(): Promise<void> | void;
  release?(): void;
}

/**
 * Options accepted when creating a PgTestkit client, including the
 * connection factory and fixture resolution hooks.
 */
export interface CreatePgTestkitClientOptions extends SchemaResolutionOptions {
  connectionFactory: () => PgQueryable | Promise<PgQueryable>;
  tableDefinitions?: TableDefinitionModel[];
  tableRows?: TableRowsFixture[];
  formatterOptions?: SqlFormatterOptions;
  missingFixtureStrategy?: MissingFixtureStrategy;
  onExecute?(
    sql: string,
    params?: unknown[] | QueryConfig['values'],
    fixtures?: string[]
  ): void;
  /** Directories whose SQL files are converted into fixtures automatically. */
  ddl?: DdlFixtureLoaderOptions;
}

/**
 * Options accepted when wrapping an existing Postgres client, mirroring
 * creation options but omitting the connection factory.
 */
export interface WrapPgClientOptions extends SchemaResolutionOptions {
  tableDefinitions?: TableDefinitionModel[];
  tableRows?: TableRowsFixture[];
  formatterOptions?: SqlFormatterOptions;
  missingFixtureStrategy?: MissingFixtureStrategy;
  onExecute?(
    sql: string,
    params?: unknown[] | QueryConfig['values'],
    fixtures?: string[]
  ): void;
  /** Shared DDL directory configuration used to infer fixtures for wrapped clients. */
  ddl?: DdlFixtureLoaderOptions;
}

/** Extends any Pg client instance with fixture-aware helper methods. */
export type WrappedPgClient<T> = T & {
  withFixtures(fixtures: TableRowsFixture[]): WrappedPgClient<T>;
};

export interface CreatePgTestkitPoolOptions extends SchemaResolutionOptions {
  tableDefinitions?: TableDefinitionModel[];
  tableRows?: TableRowsFixture[];
  /** DDL paths that should populate the base fixture set for the pool. */
  ddl?: DdlFixtureLoaderOptions;
}
export type { TableRowsFixture } from '@rawsql-ts/testkit-core';
