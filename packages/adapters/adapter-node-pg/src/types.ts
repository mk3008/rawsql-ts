import type { QueryConfig, QueryResult, QueryResultRow } from 'pg';
import type {
  FixtureTableDefinition,
  MissingFixtureStrategy,
  SqlFormatterOptions,
  TableDefinitionModel,
  TableDefinitionRegistry,
} from 'rawsql-ts';
export type { TableDefinitionModel } from 'rawsql-ts';
import type { TableRowsFixture } from '@rawsql-ts/testkit-postgres';
import type { DdlFixtureLoaderOptions } from '@rawsql-ts/testkit-core';

interface SchemaResolutionOptions {
  defaultSchema?: string;
  searchPath?: string[];
}

export type PgTableRowsFixture = TableRowsFixture;
export type PgTableDefinition = TableDefinitionModel;

export interface PgFixtureSnapshot {
  fixtureTables: FixtureTableDefinition[];
  tableDefinitions: TableDefinitionRegistry;
  fixturesApplied: string[];
}

export interface PgFixtureProvider {
  resolve(overrides?: TableRowsFixture[]): PgFixtureSnapshot;
}

export type PgQueryInput = string | QueryConfig<unknown[]>;

export interface PgQueryable {
  query<T extends QueryResultRow = QueryResultRow>(
    queryTextOrConfig: PgQueryInput,
    values?: unknown[]
  ): Promise<QueryResult<T>>;
  end?(): Promise<void> | void;
  release?(): void;
}

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
  ddl?: DdlFixtureLoaderOptions;
}

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
  ddl?: DdlFixtureLoaderOptions;
}

export type WrappedPgClient<T> = T & {
  withFixtures(fixtures: TableRowsFixture[]): WrappedPgClient<T>;
};

export interface CreatePgTestkitPoolOptions extends SchemaResolutionOptions {
  tableDefinitions?: TableDefinitionModel[];
  tableRows?: TableRowsFixture[];
  ddl?: DdlFixtureLoaderOptions;
}
/** Fixture rows describing the tables/rows used by testkit-postgres and adapter-node-pg helpers. */
export type { TableRowsFixture } from '@rawsql-ts/testkit-postgres';
