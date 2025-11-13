import { describe, expect, it } from 'vitest';
import { wrapPostgresDriver } from '../../src/proxy/wrapPostgresDriver';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { demoSchemaRegistry } from '../schema';
import { getDemoPostgresUrl } from '../runtime/postgresConfig';
import { createDemoPostgresConnection } from '../db/mockConnectionFactory';

type FixtureRowsByTable = Record<string, Array<Record<string, unknown>>>;

const describeManual = getDemoPostgresUrl() ? describe : describe.skip;

const createInterceptedConnection = async (tables: FixtureRowsByTable) => {
  // Build TableFixture objects from the inline table data to feed the rewriter context.
  const fixtures = Object.entries(tables).map(([tableName, rows]) => ({
    tableName,
    rows,
  }));
  // Each manual scenario needs its own live client to avoid leaking state between tests.
  const client = await createDemoPostgresConnection();
  // Rewrite queries using the registry so that fixture injection targets the docker baseline.
  return wrapPostgresDriver(client, {
    fixtures,
    schema: demoSchemaRegistry,
    missingFixtureStrategy: 'error',
  });
};

describeManual('Postgres customer repository (intercept)', () => {
  it('returns fixture rows instead of running the baseline query', async () => {
    const intercepted = await createInterceptedConnection({
      'public.customers': [
        {
          id: 10,
          email: 'fixture@example.com',
          display_name: 'Fixture Friend',
          tier: 'enterprise',
          suspended_at: null,
        },
      ],
    });

    const repo = new CustomerRepository(intercepted);
    const active = await repo.listActive();
    await repo.close();

    expect(active).toEqual([
      {
        id: 10,
        email: 'fixture@example.com',
        displayName: 'Fixture Friend',
        tier: 'enterprise',
        suspendedAt: null,
      },
    ]);
  });

  it('finds fixture rows when filtering by email', async () => {
    const intercepted = await createInterceptedConnection({
      'public.customers': [
        {
          id: 20,
          email: 'search@example.com',
          display_name: 'Search Customer',
          tier: 'gold',
          suspended_at: '2024-01-01T00:00:00Z',
        },
      ],
    });

    const repo = new CustomerRepository(intercepted);
    const customer = await repo.findByEmail('search@example.com');
    await repo.close();

    expect(customer).toEqual({
      id: 20,
      email: 'search@example.com',
      displayName: 'Search Customer',
      tier: 'gold',
      suspendedAt: new Date('2024-01-01T00:00:00Z'),
    });
  });
});
