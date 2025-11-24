import type { QueryConfig, QueryResult, QueryResultRow } from 'pg';
import type {
  FixtureTableDefinition,
  GenericFixture,
  GenericFixtureColumn,
  MissingFixtureStrategy,
  SqlFormatterOptions,
  TableDefinitionRegistry,
} from 'rawsql-ts';

/** Generic fixture metadata shared with PgTestkit consumers. */
export type PgFixture = GenericFixture;

/** Column metadata for fixtures provided through PgTestkit. */
export type PgFixtureColumn = GenericFixtureColumn;

/**
 * Snapshot returned after fixture resolution, containing the tables,
 * resolver-generated registry, and the applied fixture names.
 */
export interface PgFixtureSnapshot {
  fixtureTables: FixtureTableDefinition[];
  tableDefinitions: TableDefinitionRegistry;
  fixturesApplied: string[];
}

/** Resolves fixture overrides and exposes the most recently applied snapshot. */
export interface PgFixtureProvider {
  resolve(overrides?: PgFixture[]): PgFixtureSnapshot;
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
export interface CreatePgTestkitClientOptions {
  connectionFactory: () => PgQueryable | Promise<PgQueryable>;
  fixtures?: PgFixture[];
  formatterOptions?: SqlFormatterOptions;
  missingFixtureStrategy?: MissingFixtureStrategy;
  onExecute?(
    sql: string,
    params?: unknown[] | QueryConfig['values'],
    fixtures?: string[]
  ): void;
}

/**
 * Options accepted when wrapping an existing Postgres client, mirroring
 * creation options but omitting the connection factory.
 */
export interface WrapPgClientOptions {
  fixtures?: PgFixture[];
  formatterOptions?: SqlFormatterOptions;
  missingFixtureStrategy?: MissingFixtureStrategy;
  onExecute?(
    sql: string,
    params?: unknown[] | QueryConfig['values'],
    fixtures?: string[]
  ): void;
}

/** Extends any Pg client instance with fixture-aware helper methods. */
export type WrappedPgClient<T> = T & {
  withFixtures(fixtures: PgFixture[]): WrappedPgClient<T>;
};
