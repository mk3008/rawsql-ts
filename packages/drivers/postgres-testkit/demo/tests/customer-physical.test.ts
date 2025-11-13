import { describe, expect, it } from 'vitest';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { getDemoPostgresUrl } from '../runtime/postgresConfig';
import { createDemoPostgresConnection } from '../db/mockConnectionFactory';

const describeManual = getDemoPostgresUrl() ? describe : describe.skip;

describeManual('Postgres customer repository (physical)', () => {
  it('returns rows from the docker Postgres baseline', async () => {
    // Connect to the docker-backed Postgres instance for the physical baseline check.
    const client = await createDemoPostgresConnection();

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
