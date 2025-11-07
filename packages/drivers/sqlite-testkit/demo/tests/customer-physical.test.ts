import { describe, expect, it } from 'vitest';
import { createDemoConnection, tryResolveBetterSqlite } from '../db/sqliteConnectionFactory';
import { CustomerRepository } from '../repositories/CustomerRepository';

const betterSqliteFactory = tryResolveBetterSqlite();
const describeIfDriver = betterSqliteFactory ? describe : describe.skip;

const buildRepository = (): CustomerRepository => {
  return new CustomerRepository(createDemoConnection());
};

describeIfDriver('CustomerRepository physical SQLite demo', () => {
  it('returns the active customers stored on disk', () => {
    const repo = buildRepository();
    const active = repo.listActive();
    repo.close();

    expect(active.map((customer) => customer.email)).toEqual([
      'alice@example.com',
      'bob@example.com',
    ]);
  });

  it('maps nullable columns when finding a single customer', () => {
    const repo = buildRepository();
    const customer = repo.findByEmail('carol@example.com');
    repo.close();

    expect(customer).toEqual({
      id: expect.any(Number),
      email: 'carol@example.com',
      displayName: 'Carol',
      tier: 'pro',
      suspendedAt: new Date('2024-02-10T00:00:00.000Z'),
    });
  });
});
