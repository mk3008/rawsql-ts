import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect } from 'vitest';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import { createPgTestkitClient } from '@rawsql-ts/adapter-node-pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { TableDefinitionModel } from 'rawsql-ts';
import { runSqlCatalog, type SqlCatalogExecutor } from './utils/sqlCatalog';
import { sampleSqlCatalog } from './specs/sql/sample';

const containerRuntimeAvailable = (() => {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
})();

const ztdDescribe = containerRuntimeAvailable ? describe : describe.skip;

ztdDescribe('sql catalog runner (ztd)', () => {
  let container: StartedPostgreSqlContainer | null = null;
  const executedCaseIds = new Set<string>();
  const fixturesAppliedHistory: string[][] = [];
  const rewrittenSqlHistory: string[] = [];

  beforeAll(async () => {
    // Use a disposable real Postgres instance so this test reflects ZTD execution semantics.
    container = await new PostgreSqlContainer('postgres:18-alpine').start();
  }, 120000);

  runSqlCatalog(sampleSqlCatalog, {
    executor: createZtdSampleExecutor({
      onExecute: (sql, _params, fixtures) => {
        rewrittenSqlHistory.push(sql);
        fixturesAppliedHistory.push([...(fixtures ?? [])]);
      },
      getConnectionString: () => requireConnectionString(container),
    }),
    onCaseExecuted: (id) => executedCaseIds.add(id),
  });

  afterAll(async () => {
    if (container) {
      await container.stop();
    }
    expect([...executedCaseIds].sort()).toEqual([
      'returns-active-users',
      'returns-inactive-users-when-active-0',
    ]);
    expect(fixturesAppliedHistory).toEqual([['users'], ['users']]);
    expect(rewrittenSqlHistory).toHaveLength(2);
  });
});

interface ZtdSampleExecutorOptions {
  onExecute?: (sql: string, params?: unknown[], fixtures?: string[]) => void;
  getConnectionString: () => string;
}

function createZtdSampleExecutor(options: ZtdSampleExecutorOptions): SqlCatalogExecutor {
  return async (
    sql: string,
    params: Record<string, unknown>,
    fixtures: TableFixture[],
    columnMap: Record<string, string>
  ): Promise<Record<string, unknown>[]> => {
    const driver = createPgTestkitClient({
      connectionFactory: async () => {
        const connection = new Client({ connectionString: options.getConnectionString() });
        await connection.connect();
        return connection;
      },
      tableDefinitions: toTableDefinitions(fixtures),
      tableRows: fixtures.map((fixture) => ({ tableName: fixture.tableName, rows: fixture.rows })),
      onExecute: options.onExecute,
    });
    try {
      const result = await driver.query(sql, params);
      return result.rows.map((row) => projectRow(row as Record<string, unknown>, columnMap));
    } finally {
      await driver.close();
    }
  };
}

function toTableDefinitions(fixtures: TableFixture[]): TableDefinitionModel[] {
  return fixtures.map((fixture) => {
    const columns = getFixtureColumns(fixture).map(([name, typeName]) => ({
      name,
      typeName,
    }));
    return {
      name: fixture.tableName,
      columns,
    };
  });
}

function getFixtureColumns(fixture: TableFixture): Array<[string, string]> {
  if (fixture.schema && 'columns' in fixture.schema && fixture.schema.columns) {
    return Object.entries(fixture.schema.columns).map(([name, type]) => [name, String(type)]);
  }

  // Fall back to row keys when schema metadata is omitted in the fixture.
  const firstRow = fixture.rows[0];
  if (!firstRow || typeof firstRow !== 'object') {
    return [];
  }
  return Object.keys(firstRow).map((name) => [name, 'text']);
}

function requireConnectionString(container: StartedPostgreSqlContainer | null): string {
  if (!container) {
    throw new Error('Postgres container is not initialized for sql catalog ZTD runner test.');
  }
  return container.getConnectionUri();
}

function projectRow(
  row: Record<string, unknown>,
  columnMap: Record<string, string>
): Record<string, unknown> {
  const dto: Record<string, unknown> = {};
  for (const [dtoKey, columnName] of Object.entries(columnMap)) {
    dto[dtoKey] = row[columnName];
  }
  return dto;
}
