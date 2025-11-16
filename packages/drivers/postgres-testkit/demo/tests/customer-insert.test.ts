/*
DAL1.0 insert demos rely on Testkit to normalize the DTO and simulate RETURNING rows via
`simulateCudReturning`, ensuring the connection simply forwards the rewritten DTO SELECT without
fabricating metadata or hand-crafted rows.
*/

import { describe, expect, it } from 'vitest';
import { wrapPostgresDriver } from '../../src/proxy/wrapPostgresDriver';
import type { TableDef } from '@rawsql-ts/testkit-core';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { demoSchemaRegistry } from '../schema';
import type { PostgresConnectionLike, PostgresQueryCallback } from '../../src/types';
import type { QueryConfig, QueryResult, QueryResultRow } from 'pg';

const customerTableDefs: TableDef[] = [
  {
    tableName: 'public.customers',
    columns: [
      { name: 'id', dbType: 'INTEGER', nullable: false, hasDefault: true },
      { name: 'email', dbType: 'TEXT', nullable: false },
      { name: 'display_name', dbType: 'TEXT', nullable: false },
      { name: 'tier', dbType: 'TEXT', nullable: false },
      { name: 'suspended_at', dbType: 'TIMESTAMPTZ', nullable: true },
    ],
  },
];

const createSimpleConnection = (): PostgresConnectionLike => ({
  query: async (
    _textOrConfig: string | QueryConfig,
    _valuesOrCallback?: unknown[] | PostgresQueryCallback,
    _callback?: PostgresQueryCallback
  ): Promise<QueryResult<QueryResultRow>> => {
    // Provide just an empty row set so Testkit alone materializes the RETURNING result.
    return { rows: [] } as unknown as QueryResult<QueryResultRow>;
  },
});

describe('Postgres customer repository (DAL1.0 insert demo)', () => {
  it('creates a customer using DAL-level RETURNING simulation', async () => {
    const payload = {
      email: 'dal1-demo@example.com',
      displayName: 'DAL1 Insert Demo',
      tier: 'standard',
      suspendedAt: null,
    };
    const connection = createSimpleConnection();
    const driver = wrapPostgresDriver(connection, {
      schema: demoSchemaRegistry,
      tableDefs: customerTableDefs,
      simulateCudReturning: true,
      recordQueries: true,
    });

    const repo = new CustomerRepository(driver);
    const result = await repo.create(payload);

    expect(result).toMatchObject({
      email: payload.email,
      tier: payload.tier,
    });

    expect(result.id).toBe(1);
    expect(result.displayName).toBe(payload.displayName);

    // Assert the recorded SQL is the DAL-generated SELECT rather than the raw INSERT.
    const recordedSql = driver.queries?.at(-1)?.sql?.trim().toLowerCase() ?? '';
    expect(recordedSql).toContain('select');
    expect(recordedSql).not.toContain('insert into');
    expect(recordedSql).not.toContain('returning');

    await repo.close();
  });
});
