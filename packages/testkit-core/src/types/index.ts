export type SqliteAffinity = 'TEXT' | 'INTEGER' | 'REAL' | 'NUMERIC' | 'BLOB';

export interface TableSchemaDefinition {
  columns: Record<string, SqliteAffinity>;
}

export interface SchemaRegistry {
  getTable(name: string): TableSchemaDefinition | undefined;
}

export interface FixtureRow {
  [column: string]: unknown;
}

export interface TableFixture {
  tableName: string;
  rows: FixtureRow[];
  schema?: TableSchemaDefinition;
}

export type MissingFixtureStrategy = 'error' | 'passthrough' | 'warn';

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
}

export interface SelectRewriteContext {
  fixtures?: TableFixture[];
}
