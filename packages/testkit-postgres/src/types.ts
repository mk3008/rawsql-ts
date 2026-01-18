import type {
  CountableResult,
  TableRowsFixture,
  MissingFixtureStrategy,
} from '@rawsql-ts/testkit-core';
import type { SqlFormatterOptions, TableDefinitionModel } from 'rawsql-ts';
import type { DdlFixtureLoaderOptions } from '@rawsql-ts/testkit-core';

export type Row = Record<string, unknown>;
export type QueryExecutor = (sql: string, params: readonly unknown[]) => Promise<Row[]>;
export type TypedQueryExecutor<RowType extends Row = Row> = (
  sql: string,
  params: readonly unknown[]
) => Promise<RowType[]>;

export interface PostgresQueryInput {
  text: string;
  values?: unknown[];
  params?: unknown[];
}

export interface SchemaResolutionOptions {
  defaultSchema?: string;
  searchPath?: string[];
}

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

export type { TableRowsFixture } from '@rawsql-ts/testkit-core';
export type { TableDefinitionModel } from 'rawsql-ts';
