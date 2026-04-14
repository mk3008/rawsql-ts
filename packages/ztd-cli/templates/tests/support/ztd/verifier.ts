import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { Pool } from 'pg';

import type { PostgresTestkitClient } from '@rawsql-ts/testkit-postgres';
import type { QuerySpecZtdCase } from './case-types.js';

type QuerySpecExecutorClient = {
  query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]>;
};

type QuerySpecExecutor<Input, Output> = (
  client: QuerySpecExecutorClient,
  input: Input
) => Promise<Output>;

type FixtureTree = Record<string, unknown>;
type FixtureRow = Record<string, unknown>;
type FixtureTableRows = Array<{ tableName: string; rows: FixtureRow[] }>;

export type QuerySpecExecutionMode = 'ztd';

export interface QuerySpecExecutionEvidence {
  mode: QuerySpecExecutionMode;
  rewriteApplied: boolean;
  physicalSetupUsed: boolean;
  executedQueryCount: number;
  traceFilePath?: string;
}

interface QueryExecutionTrace {
  index: number;
  originalSql: string;
  boundSql: string;
  boundParams: unknown[];
  executedSql?: string;
  executedParams?: unknown[];
  fixturesApplied?: string[];
  rewriteApplied: boolean;
}

interface StarterProjectConfigFile {
  ztdRootDir?: string;
  ddlDir?: string;
  defaultSchema?: string;
  searchPath?: string[];
}

interface StarterProjectDefaults {
  projectRootDir: string;
  ztdRootDir: string;
  defaultSchema: string;
  searchPath: string[];
  ddlDirectories: string[];
}

export async function verifyQuerySpecZtdCase<BeforeDb extends FixtureTree, Input, Output>(
  querySpecCase: QuerySpecZtdCase<BeforeDb, Input, Output>,
  execute: QuerySpecExecutor<Input, Output>
): Promise<QuerySpecExecutionEvidence> {
  const connectionString = process.env.ZTD_DB_URL;
  if (!connectionString) {
    throw new Error('Set ZTD_DB_URL before running queryspec ZTD cases.');
  }

  const tableRows = flattenFixtureTableRows(querySpecCase.beforeDb).map((tableFixture) => ({
    tableName: tableFixture.tableName,
    rows: tableFixture.rows
  }));

  const trace: QueryExecutionTrace[] = [];
  const defaults = loadStarterDefaults(process.cwd());
  let pool: Pool | undefined;
  let testkitClient: PostgresTestkitClient | undefined;
  let failure: unknown;

  try {
    pool = new Pool({ connectionString });
    const { createPostgresTestkitClient } = await import('@rawsql-ts/testkit-postgres');
    testkitClient = createPostgresTestkitClient({
      queryExecutor: async (sql, params) => {
        const result = await pool!.query(sql, params as unknown[]);
        return {
          rows: result.rows,
          rowCount: result.rowCount ?? undefined
        };
      },
      defaultSchema: defaults.defaultSchema,
      searchPath: defaults.searchPath,
      tableRows,
      ddl: defaults.ddlDirectories.length > 0 ? { directories: defaults.ddlDirectories } : undefined,
      onExecute: (sql, params, fixtures) => {
        const latestTrace = trace[trace.length - 1];
        if (!latestTrace) {
          return;
        }

        latestTrace.executedSql = sql;
        latestTrace.executedParams = params;
        latestTrace.fixturesApplied = fixtures;
        latestTrace.rewriteApplied =
          normalizeSql(latestTrace.boundSql) !== normalizeSql(sql) || (fixtures?.length ?? 0) > 0;
      }
    });

    const result = execute(createQuerySpecExecutor(testkitClient, trace), querySpecCase.input);
    await expect(result).resolves.toEqual(querySpecCase.output);
    if (trace.length === 0) {
      throw new Error(
        `ZTD verifier did not execute any SQL for case "${querySpecCase.name}". Check the query boundary and fixture setup before accepting the case.`
      );
    }
  } catch (error) {
    failure = error;
  } finally {
    if (testkitClient) {
      await testkitClient.close();
    }
    if (pool) {
      await pool.end();
    }
  }

  const evidence: QuerySpecExecutionEvidence = {
    mode: 'ztd',
    rewriteApplied: trace.some((entry) => entry.rewriteApplied),
    physicalSetupUsed: false,
    executedQueryCount: trace.length
  };

  const traceFilePath = writeTraceFileIfEnabled(querySpecCase.name, trace, evidence, failure);
  if (traceFilePath) {
    evidence.traceFilePath = traceFilePath;
  }

  if (failure) {
    throw failure;
  }

  return evidence;
}

function flattenFixtureTableRows(
  fixture: FixtureTree,
  pathSegments: string[] = []
): FixtureTableRows {
  const tableRows: FixtureTableRows = [];

  for (const [key, value] of Object.entries(fixture)) {
    const nextPathSegments = [...pathSegments, key];
    if (Array.isArray(value)) {
      tableRows.push({
        tableName: nextPathSegments.join('.'),
        rows: value.map((row) => assertRecordRow(row, nextPathSegments.join('.')))
      });
      continue;
    }

    if (isPlainRecord(value)) {
      tableRows.push(...flattenFixtureTableRows(value, nextPathSegments));
      continue;
    }

    throw new Error(
      `Queryspec fixture entry ${nextPathSegments.join('.')} must be an object or an array of rows.`
    );
  }

  return tableRows;
}

function assertRecordRow(value: unknown, tableName: string): Record<string, unknown> {
  if (isPlainRecord(value)) {
    return value;
  }

  throw new Error(`Queryspec fixture rows for ${tableName} must be objects.`);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createQuerySpecExecutor(
  testkitClient: PostgresTestkitClient,
  trace: QueryExecutionTrace[]
): QuerySpecExecutorClient {
  return {
    async query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]> {
      const bound = bindNamedParams(sql, params);
      trace.push({
        index: trace.length + 1,
        originalSql: sql,
        boundSql: bound.boundSql,
        boundParams: bound.boundValues,
        rewriteApplied: false
      });

      const result = await testkitClient.query(bound.boundSql, bound.boundValues);
      return result.rows as T[];
    }
  };
}

function loadStarterDefaults(rootDir: string): StarterProjectDefaults {
  const config = loadStarterProjectConfig(rootDir);
  const defaultSchema =
    typeof config.defaultSchema === 'string' && config.defaultSchema.length > 0
      ? config.defaultSchema
      : 'public';
  const searchPath = normalizeSearchPath(config.searchPath);
  const projectRootDir = path.resolve(rootDir);
  const ztdRootDir = path.resolve(rootDir, config.ztdRootDir ?? '.ztd');
  const ddlDirectory = path.resolve(
    projectRootDir,
    typeof config.ddlDir === 'string' && config.ddlDir.trim().length > 0 ? config.ddlDir : 'db/ddl'
  );

  return {
    projectRootDir,
    ztdRootDir,
    defaultSchema,
    searchPath: searchPath.length > 0 ? searchPath : [defaultSchema],
    ddlDirectories: existsSync(ddlDirectory) ? [ddlDirectory] : []
  };
}

function loadStarterProjectConfig(rootDir: string): StarterProjectConfigFile {
  const configPath = path.join(rootDir, 'ztd.config.json');
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as StarterProjectConfigFile;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return {};
    }
    throw error;
  }
}

function normalizeSearchPath(searchPath: unknown): string[] {
  if (!Array.isArray(searchPath)) {
    return [];
  }

  return searchPath.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function writeTraceFileIfEnabled(
  caseName: string,
  trace: QueryExecutionTrace[],
  evidence: QuerySpecExecutionEvidence,
  failure?: unknown
): string | undefined {
  if (!isTraceEnabled()) {
    return undefined;
  }

  const traceDir = resolveTraceDir();
  mkdirSync(traceDir, { recursive: true });

  const fileName = `${createSafeFileSegment(caseName)}-${Date.now()}-${process.pid}.json`;
  const traceFilePath = path.join(traceDir, fileName);

  writeFileSync(
    traceFilePath,
      `${JSON.stringify(
        {
          caseName,
          evidence,
          failure: serializeTraceFailure(failure),
          trace
        },
        null,
        2
      )}\n`,
    'utf8'
  );

  return traceFilePath;
}

function serializeTraceFailure(failure: unknown): Record<string, unknown> | undefined {
  if (failure === undefined) {
    return undefined;
  }

  if (failure instanceof Error) {
    return {
      name: failure.name,
      message: failure.message,
      stack: failure.stack
    };
  }

  return {
    name: 'Error',
    message: String(failure)
  };
}

function isTraceEnabled(): boolean {
  const value = process.env.ZTD_SQL_TRACE;
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function resolveTraceDir(): string {
  const configuredDir = process.env.ZTD_SQL_TRACE_DIR;
  if (configuredDir && configuredDir.trim().length > 0) {
    return path.resolve(process.cwd(), configuredDir);
  }

  return path.join(process.cwd(), '.ztd', 'tmp', 'sql-trace');
}

function createSafeFileSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'queryspec-case';
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

interface BoundNamedSql {
  boundSql: string;
  boundValues: unknown[];
}

function bindNamedParams(sql: string, params: Record<string, unknown>): BoundNamedSql {
  const scan = scanNamedParams(sql);
  if (scan.mode !== 'named') {
    return {
      boundSql: sql,
      boundValues: []
    };
  }

  const orderedValues: unknown[] = [];
  const slotByName = new Map<string, number>();
  let cursor = 0;
  let boundSql = '';

  for (const token of scan.namedTokens) {
    boundSql += sql.slice(cursor, token.start);
    let slot = slotByName.get(token.name);
    if (!slot) {
      orderedValues.push(resolveNamedParam(params, token.name));
      slot = orderedValues.length;
      slotByName.set(token.name, slot);
    }
    boundSql += `$${slot}`;
    cursor = token.end;
  }

  boundSql += sql.slice(cursor);
  return {
    boundSql,
    boundValues: orderedValues
  };
}

function resolveNamedParam(params: Record<string, unknown>, name: string): unknown {
  if (!(name in params)) {
    throw new Error(`Missing named query param: ${name}`);
  }
  return params[name];
}

type PlaceholderMode = 'none' | 'named' | 'positional';

interface NamedToken {
  start: number;
  end: number;
  name: string;
}

function scanNamedParams(sql: string): { mode: PlaceholderMode; namedTokens: NamedToken[] } {
  const namedTokens: NamedToken[] = [];
  let index = 0;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1] ?? '';

    if (current === '\'') {
      index = skipSingleQuotedString(sql, index);
      continue;
    }
    if (current === '"') {
      index = skipDoubleQuotedIdentifier(sql, index);
      continue;
    }
    if (current === '-' && next === '-') {
      index = skipLineComment(sql, index);
      continue;
    }
    if (current === '/' && next === '*') {
      index = skipBlockComment(sql, index);
      continue;
    }
    if (current === '$') {
      const dollarQuote = readDollarQuoteDelimiter(sql, index);
      if (dollarQuote) {
        index = skipDollarQuotedString(sql, index, dollarQuote);
        continue;
      }
    }
    if (current === ':') {
      if (next === ':') {
        index += 2;
        continue;
      }
      if (/[A-Za-z_]/.test(next)) {
        const end = consumeIdentifier(sql, index + 1);
        namedTokens.push({
          start: index,
          end,
          name: sql.slice(index + 1, end)
        });
        index = end;
        continue;
      }
    }

    index += 1;
  }

  return {
    mode: namedTokens.length > 0 ? 'named' : 'none',
    namedTokens
  };
}

function skipSingleQuotedString(sql: string, start: number): number {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === '\'' && sql[index + 1] === '\'') {
      index += 2;
      continue;
    }
    if (sql[index] === '\'') {
      return index + 1;
    }
    index += 1;
  }
  return sql.length;
}

function skipDoubleQuotedIdentifier(sql: string, start: number): number {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === '"' && sql[index + 1] === '"') {
      index += 2;
      continue;
    }
    if (sql[index] === '"') {
      return index + 1;
    }
    index += 1;
  }
  return sql.length;
}

function skipLineComment(sql: string, start: number): number {
  let index = start + 2;
  while (index < sql.length && sql[index] !== '\n') {
    index += 1;
  }
  return index;
}

function skipBlockComment(sql: string, start: number): number {
  let index = start + 2;
  while (index < sql.length) {
    if (sql[index] === '*' && sql[index + 1] === '/') {
      return index + 2;
    }
    index += 1;
  }
  return sql.length;
}

function readDollarQuoteDelimiter(sql: string, start: number): string | null {
  let index = start + 1;
  while (index < sql.length && /[A-Za-z0-9_]/.test(sql[index] ?? '')) {
    index += 1;
  }
  if (sql[index] === '$') {
    return sql.slice(start, index + 1);
  }
  return null;
}

function skipDollarQuotedString(sql: string, start: number, delimiter: string): number {
  const closeIndex = sql.indexOf(delimiter, start + delimiter.length);
  return closeIndex >= 0 ? closeIndex + delimiter.length : sql.length;
}

function consumeIdentifier(sql: string, start: number): number {
  let index = start;
  while (index < sql.length && /[A-Za-z0-9_]/.test(sql[index] ?? '')) {
    index += 1;
  }
  return index;
}
