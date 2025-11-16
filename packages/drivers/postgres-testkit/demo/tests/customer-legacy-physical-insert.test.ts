import { describe, expect, it } from 'vitest';
import { wrapPostgresDriver } from '../../src/proxy/wrapPostgresDriver';
import type { TableDef } from '@rawsql-ts/testkit-core';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { demoSchemaRegistry } from '../schema';
import { getDemoPostgresUrl } from '../runtime/postgresConfig';
import { createDemoPostgresConnection } from '../db/mockConnectionFactory';

const describeManual = getDemoPostgresUrl() ? describe : describe.skip;

// Provide a minimal TableDef snapshot so the TestkitDbAdapter can run the CUD pipeline.
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

// Legacy-style demo: this test hits a real Postgres table inside a transaction.
// The DAL1.0 demo shows how to test the same repository without any physical tables.
describeManual('Postgres customer repository (legacy physical insert demo)', () => {
  it('persists a new customer row against a real Postgres table (legacy style)', async () => {
    const connection = await createDemoPostgresConnection();
    const driver = wrapPostgresDriver(connection, {
      schema: demoSchemaRegistry,
      tableDefs: customerTableDefs,
      recordQueries: true,
    });
    const repo = new CustomerRepository(driver);
    const email = `insert-demo+${Date.now()}@example.com`;
    const payload = {
      email,
      displayName: 'Insert Demo',
      tier: 'standard',
      suspendedAt: null,
    };

    // Keep this manual insert isolated by running inside an explicit transaction.
    await connection.query('BEGIN');
    try {
      const inserted = await repo.create(payload);
      expect(inserted).toMatchObject({ email, tier: 'standard' });
      // Confirm the recorded SQL flows through the testkit instrumentation.
      const hasInsertQuery = driver.queries?.some((entry) =>
        entry.sql.toLowerCase().includes('insert into public.customers')
      );
      expect(hasInsertQuery).toBe(true);
    } finally {
      // Roll back everything after the assertion so the manual demo stays repeatable.
      await connection.query('ROLLBACK');
      await repo.close();
    }
  });
});
