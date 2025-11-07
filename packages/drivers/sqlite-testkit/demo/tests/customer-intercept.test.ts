import { describe, expect, it } from 'vitest';
import { wrapSqliteDriver } from '../../src/proxy/wrapSqliteDriver';
import { createDemoConnection, tryResolveBetterSqlite } from '../db/sqliteConnectionFactory';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { demoSchemaRegistry } from '../schema';

type FixtureRowsByTable = Record<string, Array<Record<string, unknown>>>;

const buildFixtureList = (tables: FixtureRowsByTable) => {
  // Convert a record-of-rows into the array format expected by wrapSqliteDriver.
  return Object.entries(tables).map(([tableName, rows]) => ({
    tableName,
    rows,
  }));
};

const betterSqliteFactory = tryResolveBetterSqlite();
const describeIfDriver = betterSqliteFactory ? describe : describe.skip;

const createInterceptedRepository = (tableRows: FixtureRowsByTable): CustomerRepository => {
  // Wrap the demo connection once so all tests share the same schema registry per environment.
  const interceptedConnection = wrapSqliteDriver(createDemoConnection(), {
    fixtures: buildFixtureList(tableRows),
    schema: demoSchemaRegistry,
    missingFixtureStrategy: 'error',
  });
  return new CustomerRepository(interceptedConnection);
};

describeIfDriver('CustomerRepository SQL interception demo', () => {
  it('returns the active customers from fixtures instead of disk', () => {
    const repo = createInterceptedRepository({
      customers: [
        {
          id: 4242,
          email: 'intercepted@example.com',
          display_name: 'Intercepted User',
          tier: 'enterprise',
          suspended_at: null,
        },
      ],
      customer_tiers: [
        {
          tier: 'enterprise',
          monthly_quota: 1000,
          priority_level: 'gold',
          escalation_sla_hours: 1,
        },
      ],
    });
    const active = repo.listActive();
    repo.close();

    expect(active).toEqual([
      {
        id: 4242,
        email: 'intercepted@example.com',
        displayName: 'Intercepted User',
        tier: 'enterprise',
        suspendedAt: null,
      },
    ]);
  });

  it('maps fixture rows when finding a single customer', () => {
    const repo = createInterceptedRepository({
      customers: [
        {
          id: 5000,
          email: 'carol@example.com',
          display_name: 'Fixture Carol',
          tier: 'vip',
          suspended_at: '2024-12-31T00:00:00.000Z',
        },
      ],
      customer_notes: [
        {
          id: 1,
          customer_id: 5000,
          body: 'Renewal blocked until billing updates payment method.',
          created_at: '2024-12-15T00:00:00.000Z',
        },
      ],
    });
    const customer = repo.findByEmail('carol@example.com');
    repo.close();

    expect(customer).toEqual({
      id: 5000,
      email: 'carol@example.com',
      displayName: 'Fixture Carol',
      tier: 'vip',
      suspendedAt: new Date('2024-12-31T00:00:00.000Z'),
    });
  });
});
