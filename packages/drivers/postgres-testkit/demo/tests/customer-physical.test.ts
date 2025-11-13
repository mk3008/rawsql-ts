import { describe, expect, it } from 'vitest';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { createDemoPostgresConnection } from '../db/mockConnectionFactory';

describe('Postgres customer repository (physical)', () => {
  it('returns rows from the mock connection directly', async () => {
    const client = createDemoPostgresConnection({
      public__customers: [
        {
          id: 1,
          email: 'physical@example.com',
          display_name: 'Physical Customer',
          tier: 'standard',
          suspended_at: null,
        },
      ],
    });

    const repo = new CustomerRepository(client);
    const active = await repo.listActive();
    const customer = await repo.findByEmail('physical@example.com');
    await repo.close();

    expect(active).toEqual([
      {
        id: 1,
        email: 'physical@example.com',
        displayName: 'Physical Customer',
        tier: 'standard',
        suspendedAt: null,
      },
    ]);
    expect(customer).toEqual(active[0]);
  });
});
