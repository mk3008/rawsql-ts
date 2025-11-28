import type {
  FixtureTableDefinition,
  SqlFormatterOptions,
  TableDefinitionModel,
  TableDefinitionRegistry,
} from 'rawsql-ts';
export type { TableDefinitionModel } from 'rawsql-ts';

export type SqliteAffinity = 'TEXT' | 'INTEGER' | 'REAL' | 'NUMERIC' | 'BLOB';

export interface TableSchemaDefinition {
  columns: Record<string, SqliteAffinity>;
}

export interface SchemaRegistry {
  getTable(
    name: string
  ): TableSchemaDefinition | TableDefinitionModel | undefined;
}

export interface FixtureRow {
  [column: string]: unknown;
}

export interface TableRowsFixture {
  tableName: string;
  rows: FixtureRow[];
}

export interface TableFixture extends TableRowsFixture {
  schema?: TableSchemaDefinition | TableDefinitionModel;
}

export type MissingFixtureStrategy = 'error' | 'passthrough' | 'warn';
export type AnalyzerFailureBehavior = 'error' | 'skip' | 'inject';

export interface TestkitLogger {
  debug?(message: string, meta?: Record<string, unknown>): void;
  info?(message: string, meta?: Record<string, unknown>): void;
  warn?(message: string, meta?: Record<string, unknown>): void;
  error?(message: string, meta?: Record<string, unknown>): void;
}

export interface SelectRewriteResult {
  sql: string;
  fixturesApplied: string[];
}

export interface SelectRewriterOptions {
  fixtures?: TableFixture[];
  schema?: SchemaRegistry;
  missingFixtureStrategy?: MissingFixtureStrategy;
  passthroughTables?: string[];
  logger?: TestkitLogger;
  formatterOptions?: SqlFormatterOptions;
  cteConflictBehavior?: 'error' | 'override';
  analyzerFailureBehavior?: AnalyzerFailureBehavior;
}

export interface SelectRewriteContext {
  fixtures?: TableFixture[];
  formatterOptions?: SqlFormatterOptions;
  analyzerFailureBehavior?: AnalyzerFailureBehavior;
}

/** Represents the resolved state returned by a fixture provider. */
export interface FixtureSnapshot {
  fixtureTables: FixtureTableDefinition[];
  tableDefinitions: TableDefinitionRegistry;
  fixturesApplied: string[];
}

/** Responsible for resolving fixture overrides and exposing the latest snapshot. */
export interface FixtureResolver {
  resolve(overrides?: TableRowsFixture[]): FixtureSnapshot;
}

