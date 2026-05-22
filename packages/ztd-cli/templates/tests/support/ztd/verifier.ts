import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';

import type { PostgresTestkitClient } from '@rawsql-ts/testkit-postgres';
import type { QuerySpecTraditionalCase, QuerySpecZtdCase } from './case-types.js';

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
export type QuerySpecSupportedExecutionMode = 'ztd' | 'traditional';

export interface QuerySpecExecutionEvidence {
  mode: QuerySpecSupportedExecutionMode;
  rewriteApplied: boolean;
  physicalSetupUsed: boolean;
  executedQueryCount: number;
  traceFilePath?: string;
}

interface PhysicalQuerySpecExecutorClient extends QuerySpecExecutorClient {
  close(): Promise<void>;
  assertAfterDb(afterDb: FixtureTree): Promise<void>;
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
    throw new Error(buildStarterDbSetupMessage('query-boundary ZTD cases'));
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
    throw wrapStarterDbFailureIfHelpful(failure, 'query-boundary ZTD cases', connectionString);
  }

  return evidence;
}

export async function verifyQuerySpecTraditionalCase<BeforeDb extends FixtureTree, Input, Output>(
  querySpecCase: QuerySpecTraditionalCase<BeforeDb, Input, Output>,
  execute: QuerySpecExecutor<Input, Output>
): Promise<QuerySpecExecutionEvidence> {
  const connectionString = process.env.ZTD_DB_URL;
  if (!connectionString) {
    throw new Error(buildStarterDbSetupMessage('query-boundary traditional cases'));
  }

  const trace: QueryExecutionTrace[] = [];
  const defaults = loadStarterDefaults(process.cwd());
  const pool = new Pool({ connectionString });
  let client: PhysicalQuerySpecExecutorClient | undefined;
  let failure: unknown;

  try {
    client = await createPhysicalQuerySpecExecutor(pool, defaults, querySpecCase.beforeDb, trace);
    const result = execute(client, querySpecCase.input);
    await expect(result).resolves.toEqual(querySpecCase.output);
    if (querySpecCase.afterDb) {
      await client.assertAfterDb(querySpecCase.afterDb);
    }
    if (trace.length === 0) {
      throw new Error(
        `Traditional verifier did not execute any SQL for case "${querySpecCase.name}". Check the query boundary and fixture setup before accepting the case.`
      );
    }
  } catch (error) {
    failure = error;
  } finally {
    if (client) {
      await client.close();
    } else {
      await pool.end();
    }
  }

  const evidence: QuerySpecExecutionEvidence = {
    mode: 'traditional',
    rewriteApplied: false,
    physicalSetupUsed: true,
    executedQueryCount: trace.length
  };

  const traceFilePath = writeTraceFileIfEnabled(querySpecCase.name, trace, evidence, failure);
  if (traceFilePath) {
    evidence.traceFilePath = traceFilePath;
  }

  if (failure) {
    throw wrapStarterDbFailureIfHelpful(failure, 'query-boundary traditional cases', connectionString);
  }

  return evidence;
}

function buildStarterDbSetupMessage(context: string): string {
  return [
    `ZTD_DB_URL is not set before running ${context}.`,
    '',
    'Next steps:',
    '1. Copy `.env.example` to `.env`.',
    '2. Set `ZTD_DB_PORT=5432`, or choose another free host port.',
    '3. Start the starter Postgres database with `docker compose up -d`.',
    '4. Rerun `npx vitest run`.',
    '',
    'The generated Vitest setup derives `ZTD_DB_URL` from `ZTD_DB_PORT`.',
    'If Docker reports `all predefined address pools have been fully subnetted`, fix Docker networking first; changing `ZTD_DB_PORT` alone will not recover that error.'
  ].join('\n');
}

function wrapStarterDbFailureIfHelpful(error: unknown, context: string, connectionString: string): unknown {
  if (!isStarterDbConnectionFailure(error)) {
    return error;
  }

  const originalMessage = error instanceof Error ? error.message : String(error);
  const wrapped = new Error(
    [
      `The starter Postgres database was not reachable while running ${context}.`,
      '',
      `Connection target: ${describeConnectionTarget(connectionString)}`,
      `Original error: ${originalMessage}`,
      '',
      'Next steps:',
      '1. Start the bundled database with `docker compose up -d`.',
      '2. If port 5432 is already in use, set another `ZTD_DB_PORT` in `.env` and rerun `docker compose up -d`.',
      '3. Wait until Postgres is ready, then rerun `npx vitest run`.',
      '',
      'If Docker reports `all predefined address pools have been fully subnetted`, fix Docker networking first; changing `ZTD_DB_PORT` alone will not recover that error.'
    ].join('\n')
  );
  (wrapped as Error & { cause?: unknown }).cause = error;
  return wrapped;
}

function isStarterDbConnectionFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', '28P01', '3D000'].includes(code)) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /connection terminated|connection timeout|password authentication failed|getaddrinfo|connect econnrefused/i.test(message);
}

function describeConnectionTarget(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}/${url.pathname.replace(/^\/+/, '')}`;
  } catch {
    return 'configured ZTD_DB_URL';
  }
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
      `Query-boundary fixture entry ${nextPathSegments.join('.')} must be an object or an array of rows.`
    );
  }

  return tableRows;
}

function assertRecordRow(value: unknown, tableName: string): Record<string, unknown> {
  if (isPlainRecord(value)) {
    return value;
  }

  throw new Error(`Query-boundary fixture rows for ${tableName} must be objects.`);
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

async function createPhysicalQuerySpecExecutor(
  pool: Pool,
  defaults: StarterProjectDefaults,
  beforeDb: FixtureTree,
  trace: QueryExecutionTrace[]
): Promise<PhysicalQuerySpecExecutorClient> {
  const client = await pool.connect();
  const schemaName = createPhysicalSchemaName();
  let closed = false;

  try {
    await client.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
    await client.query(`SET search_path TO ${buildPhysicalSearchPath(defaults.searchPath, schemaName)}`);
    await applySqlFiles(client, defaults.ddlDirectories, defaults.defaultSchema, schemaName);
    await seedFixtureRows(client, flattenFixtureTableRows(beforeDb), defaults.defaultSchema, schemaName);
  } catch (error) {
    try {
      await dropPhysicalSchema(client, schemaName);
    } finally {
      client.release();
      await pool.end();
    }
    throw error;
  }

  return {
    async query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]> {
      const bound = bindNamedParams(sql, params);
      const executedSql = rewriteSchemaQualifiedSql(bound.boundSql, defaults.defaultSchema, schemaName);
      trace.push({
        index: trace.length + 1,
        originalSql: sql,
        boundSql: bound.boundSql,
        boundParams: bound.boundValues,
        executedSql,
        executedParams: bound.boundValues,
        rewriteApplied: false
      });
      const result = await client.query(executedSql, bound.boundValues);
      return result.rows as T[];
    },
    async assertAfterDb(afterDb: FixtureTree): Promise<void> {
      const expectedTables = flattenFixtureTableRows(afterDb);
      for (const tableFixture of expectedTables) {
        const tableName = toPhysicalTableName(tableFixture.tableName, defaults.defaultSchema, schemaName);
        const rows = await client.query(`SELECT * FROM ${tableName}`);
        if (tableFixture.rows.length === 0) {
          expect(rows.rows).toEqual([]);
          continue;
        }
        expect(rows.rows).toEqual(
          expect.arrayContaining(tableFixture.rows.map((row) => expect.objectContaining(row)))
        );
      }
    },
    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      try {
        await dropPhysicalSchema(client, schemaName);
      } finally {
        client.release();
        await pool.end();
      }
    }
  };
}

async function applySqlFiles(
  client: PoolClient,
  ddlDirectories: string[],
  defaultSchema: string,
  schemaName: string
): Promise<void> {
  for (const ddlDirectory of ddlDirectories) {
    for (const fileName of readdirSync(ddlDirectory).filter((entry) => entry.endsWith('.sql')).sort()) {
      const sql = readFileSync(path.join(ddlDirectory, fileName), 'utf8').trim();
      if (sql.length === 0) {
        continue;
      }
      await client.query(rewriteSchemaQualifiedSql(sql, defaultSchema, schemaName));
    }
  }
}

async function seedFixtureRows(
  client: PoolClient,
  tableFixtures: FixtureTableRows,
  defaultSchema: string,
  schemaName: string
): Promise<void> {
  for (const tableFixture of tableFixtures) {
    for (const row of tableFixture.rows) {
      const columns = Object.keys(row);
      if (columns.length === 0) {
        continue;
      }
      const tableName = toPhysicalTableName(tableFixture.tableName, defaultSchema, schemaName);
      const columnList = columns.map(quoteIdentifier).join(', ');
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const values = columns.map((column) => row[column]);
      await client.query(`INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`, values);
    }
  }
}

async function dropPhysicalSchema(client: PoolClient, schemaName: string): Promise<void> {
  await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`);
}

function createPhysicalSchemaName(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `ztd_traditional_${Date.now()}_${process.pid}_${random}`;
}

function toPhysicalTableName(tableName: string, defaultSchema: string, schemaName: string): string {
  const segments = tableName.split('.').map((segment) => segment.trim()).filter(Boolean);
  const tableSegment = segments.at(-1);
  if (!tableSegment) {
    throw new Error(`Invalid fixture table name: ${tableName}`);
  }
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableSegment)}`;
}

function rewriteSchemaQualifiedSql(sql: string, defaultSchema: string, schemaName: string): string {
  let rewritten = '';
  let index = 0;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1] ?? '';

    if (current === '\'') {
      const end = skipSingleQuotedString(sql, index);
      rewritten += sql.slice(index, end);
      index = end;
      continue;
    }
    if (current === '-' && next === '-') {
      const end = skipLineComment(sql, index);
      rewritten += sql.slice(index, end);
      index = end;
      continue;
    }
    if (current === '/' && next === '*') {
      const end = skipBlockComment(sql, index);
      rewritten += sql.slice(index, end);
      index = end;
      continue;
    }
    if (current === '$') {
      const dollarQuote = readDollarQuoteDelimiter(sql, index);
      if (dollarQuote) {
        const end = skipDollarQuotedString(sql, index, dollarQuote);
        rewritten += sql.slice(index, end);
        index = end;
        continue;
      }
    }

    const qualifier = readDefaultSchemaQualifier(sql, index, defaultSchema);
    if (qualifier) {
      rewritten += `${quoteIdentifier(schemaName)}.`;
      index = qualifier.end;
      continue;
    }

    rewritten += current;
    index += 1;
  }

  return rewritten;
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildPhysicalSearchPath(searchPath: string[], schemaName: string): string {
  const schemas = [schemaName, ...searchPath.filter((entry) => entry !== schemaName)];
  return schemas.map(formatSearchPathEntry).join(', ');
}

function formatSearchPathEntry(entry: string): string {
  const normalized = entry.toLowerCase();
  if (entry === '$user' || /^pg_temp($|_)/.test(normalized)) {
    return entry;
  }
  return quoteIdentifier(entry);
}

function readDefaultSchemaQualifier(
  sql: string,
  start: number,
  defaultSchema: string
): { end: number } | null {
  const previous = sql[start - 1] ?? '';
  if (previous === '.' || /[A-Za-z0-9_"]/.test(previous)) {
    return null;
  }

  if (sql[start] === '"') {
    const quoted = readQuotedIdentifier(sql, start);
    if (!quoted || quoted.value !== defaultSchema || sql[quoted.end] !== '.') {
      return null;
    }
    return { end: quoted.end + 1 };
  }

  if (!/[A-Za-z_]/.test(sql[start] ?? '')) {
    return null;
  }

  const end = consumeIdentifier(sql, start);
  if (sql.slice(start, end) !== defaultSchema || sql[end] !== '.') {
    return null;
  }

  return { end: end + 1 };
}

function readQuotedIdentifier(sql: string, start: number): { end: number; value: string } | null {
  let index = start + 1;
  let value = '';
  while (index < sql.length) {
    if (sql[index] === '"' && sql[index + 1] === '"') {
      value += '"';
      index += 2;
      continue;
    }
    if (sql[index] === '"') {
      return { end: index + 1, value };
    }
    value += sql[index];
    index += 1;
  }
  return null;
}

function loadStarterDefaults(rootDir: string): StarterProjectDefaults {
  const config = loadStarterProjectConfig(rootDir);
  const configuredDefaultSchema =
    typeof config.defaultSchema === 'string' ? config.defaultSchema.trim() : '';
  const defaultSchema = configuredDefaultSchema.length > 0 ? configuredDefaultSchema : 'public';
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

  return searchPath
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
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
