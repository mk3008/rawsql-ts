import type {
  FixtureTableDefinition,
  SqlFormatterOptions,
  TableDefinitionModel,
  TableDefinitionRegistry,
} from 'rawsql-ts';
export type { TableDefinitionModel } from 'rawsql-ts';
import type { TableNameResolver } from '../fixtures/TableNameResolver';
import type { ColumnAffinity } from '../fixtures/ColumnAffinity';

/**
 * Declared column type tokens for schema metadata. Accepts raw DDL type names
 * and precomputed affinity values for compatibility.
 */
export type SchemaColumnType = string | ColumnAffinity;

/**
 * Minimal schema metadata used by fixtures when no full table model is
 * available.
 */
export interface TableSchemaDefinition {
  columns: Record<string, SchemaColumnType>;
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
  sourceCommand?: string | null;
  isCountWrapper?: boolean;
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
  tableNameResolver?: TableNameResolver;
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

