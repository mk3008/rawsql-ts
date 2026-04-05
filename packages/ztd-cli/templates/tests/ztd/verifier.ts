import { Pool, type PoolClient } from 'pg';
import { expect } from 'vitest';

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

export async function verifyQuerySpecZtdCase<BeforeDb extends FixtureTree, Input, Output>(
  querySpecCase: QuerySpecZtdCase<BeforeDb, Input, Output>,
  execute: QuerySpecExecutor<Input, Output>
): Promise<void> {
  const connectionString = process.env.ZTD_DB_URL ?? process.env.ZTD_TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error('Set ZTD_DB_URL or ZTD_TEST_DATABASE_URL before running queryspec ZTD cases.');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await resetFixtureTables(client, querySpecCase.beforeDb);
    await seedFixture(client, querySpecCase.beforeDb);

    const result = await execute(createQuerySpecExecutor(client), querySpecCase.input);
    expect(result).toEqual(querySpecCase.output);

    if (querySpecCase.afterDb) {
      await expectAfterDbState(client, querySpecCase.afterDb);
    }
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
    await pool.end();
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
      `Queryspec fixture entry ${nextPathSegments.join('.')} must be an object or an array of rows.`
    );
  }

  return tableRows;
}

async function seedFixture(client: PoolClient, fixture: FixtureTree): Promise<void> {
  for (const tableFixture of flattenFixtureTableRows(fixture)) {
    for (const row of tableFixture.rows) {
      await insertFixtureRow(client, tableFixture.tableName, row);
    }
  }
}

async function resetFixtureTables(client: PoolClient, fixture: FixtureTree): Promise<void> {
  const tableNames = flattenFixtureTableRows(fixture).map((tableFixture) => quoteQualifiedTableName(tableFixture.tableName));
  if (tableNames.length === 0) {
    return;
  }

  await client.query(`truncate table ${tableNames.join(', ')} restart identity cascade`);
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

function createQuerySpecExecutor(client: PoolClient): QuerySpecExecutorClient {
  return {
    async query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]> {
      const bound = bindNamedParams(sql, params);
      const result = await client.query(bound.boundSql, bound.boundValues);
      return result.rows as T[];
    }
  };
}

async function expectAfterDbState(client: PoolClient, afterDb: FixtureTree): Promise<void> {
  const fixtures = flattenFixtureTableRows(afterDb);
  for (const fixture of fixtures) {
    const result = await client.query(`select * from ${quoteQualifiedTableName(fixture.tableName)}`);
    expectRowsMatchSubset(
      result.rows as Array<Record<string, unknown>>,
      fixture.rows as Array<Record<string, unknown>>
    );
  }
}

function expectRowsMatchSubset(
  actualRows: Array<Record<string, unknown>>,
  expectedRows: Array<Record<string, unknown>>
): void {
  expect(actualRows).toHaveLength(expectedRows.length);

  const remainingRows = [...actualRows];
  for (const expectedRow of expectedRows) {
    const matchIndex = remainingRows.findIndex((row) => isSubsetMatch(row, expectedRow));
    expect(matchIndex).toBeGreaterThanOrEqual(0);
    if (matchIndex >= 0) {
      remainingRows.splice(matchIndex, 1);
    }
  }
}

function isSubsetMatch(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      return false;
    }
    return expected.every((expectedItem, index) => isSubsetMatch(actual[index], expectedItem));
  }

  if (isPlainRecord(expected)) {
    if (!isPlainRecord(actual)) {
      return false;
    }

    return Object.entries(expected).every(([key, expectedValue]) =>
      isSubsetMatch(actual[key], expectedValue)
    );
  }

  return Object.is(actual, expected);
}

function quoteQualifiedTableName(tableName: string): string {
  return tableName
    .trim()
    .split('.')
    .map((segment) => `"${segment.replace(/"/g, '""')}"`)
    .join('.');
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function insertFixtureRow(
  client: PoolClient,
  tableName: string,
  row: Record<string, unknown>
): Promise<void> {
  const columnNames = Object.keys(row);
  if (columnNames.length === 0) {
    await client.query(`insert into ${quoteQualifiedTableName(tableName)} default values`);
    return;
  }

  const sql = `insert into ${quoteQualifiedTableName(tableName)} (${columnNames
    .map(quoteIdentifier)
    .join(', ')}) values (${columnNames.map((_, index) => `$${index + 1}`).join(', ')})`;
  const values = columnNames.map((columnName) => row[columnName]);
  await client.query(sql, values);
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
