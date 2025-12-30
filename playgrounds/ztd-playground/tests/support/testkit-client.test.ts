import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, QueryResultRow } from 'pg';
import type { TableFixture } from '@rawsql-ts/testkit-core';

const queryLog: Array<{ text: string; values?: unknown[] }> = [];
const connectMock = vi.fn(() => Promise.resolve());
const endMock = vi.fn(() => Promise.resolve());
const queryMock = vi.fn(async (text: string | { text: string }, values?: unknown[]) => {
  const sql = typeof text === 'string' ? text : text.text;
  queryLog.push({ text: sql, values });
  return { rows: [] as QueryResultRow[] };
});

class MockClient implements Pick<Client, 'connect' | 'query' | 'end'> {
  connect = connectMock;
  query = queryMock as unknown as Client['query'];
  end = endMock;
}

vi.mock('pg', async () => {
  const actual = await vi.importActual<typeof import('pg')>('pg');
  return {
    ...actual,
    Client: vi.fn(() => new MockClient()),
  };
});

let createTestkitClient: typeof import('./testkit-client').createTestkitClient;

beforeAll(async () => {
  const module = await import('./testkit-client');
  createTestkitClient = module.createTestkitClient;
});

beforeEach(() => {
  queryLog.length = 0;
  connectMock.mockClear();
  queryMock.mockClear();
  endMock.mockClear();
});

afterEach(() => {
  delete process.env.DATABASE_URL;
});

describe('traditional execution mode helper', () => {
  const fixtures: TableFixture[] = [
    { tableName: 'public.playground_customers', rows: [{ id: 1, name: 'alice' }] },
  ];

  it('creates schema, seeds fixtures, and drops schema by default', async () => {
    process.env.DATABASE_URL = 'postgres://default';
    const client = await createTestkitClient(fixtures, {
      mode: 'traditional',
      traditional: {
        schemaName: 'test_schema',
        cleanup: 'drop_schema',
      },
    });

    await client.query('SELECT 1');
    await client.close();

    expect(
      queryLog.some((entry) => entry.text.includes('CREATE SCHEMA IF NOT EXISTS "test_schema"')),
    ).toBe(true);
    expect(queryLog.some((entry) => entry.text.includes('SET search_path TO "test_schema", public'))).toBe(
      true,
    );
    expect(
      queryLog.some((entry) => entry.text.includes('INSERT INTO "test_schema"."playground_customers"')),
    ).toBe(true);

    const selectIndex = queryLog.findIndex((entry) => entry.text === 'SELECT 1');
    const dropIndex = queryLog.findIndex((entry) =>
      entry.text.includes('DROP SCHEMA IF EXISTS "test_schema" CASCADE'),
    );
    expect(selectIndex).toBeGreaterThan(-1);
    expect(dropIndex).toBeGreaterThan(selectIndex);
  });

  it('runs custom cleanup SQL instead of dropping the schema', async () => {
    process.env.DATABASE_URL = 'postgres://custom';
    const client = await createTestkitClient(fixtures, {
      mode: 'traditional',
      traditional: {
        schemaName: 'custom_cleanup_schema',
        cleanup: 'custom_sql',
        cleanupSql: ['DELETE FROM "custom_cleanup_schema"."playground_customers"'],
      },
    });

    await client.query('SELECT 2');
    await client.close();

    expect(
      queryLog.some((entry) =>
        entry.text.includes('DELETE FROM "custom_cleanup_schema"."playground_customers"'),
      ),
    ).toBe(true);
    expect(
      queryLog.some((entry) => entry.text.includes('DROP SCHEMA IF EXISTS "custom_cleanup_schema" CASCADE')),
    ).toBe(false);
  });
});
