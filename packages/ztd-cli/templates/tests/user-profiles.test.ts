import { describe, expect, test, afterAll } from 'vitest';
import type { TableFixture, TestkitProvider } from '@rawsql-ts/testkit-core';
import { createTestkitProvider } from '@rawsql-ts/testkit-core';
import { createPgTestkitClient } from '@rawsql-ts/pg-testkit';
import { Pool } from 'pg';
import path from 'node:path';
import {
  tableFixture,
  tableSchemas,
  TestRowMap,
} from './generated/ztd-row-map.generated';
import { listUserProfiles } from '../src/repositories/user-accounts';

const ddlDirectories = [path.resolve(__dirname, '../ztd/ddl')];
const skipReason = 'DATABASE_URL is not configured';
const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
const suiteTitle = configuredDatabaseUrl
  ? 'user profile mapper'
  : `user profile mapper (skipped: ${skipReason})`;
const describeUserProfile = configuredDatabaseUrl
  ? describe
  : (describe.skip as typeof describe);
let pool: Pool | undefined;
let providerPromise: Promise<TestkitProvider> | undefined;

// Lazily initialize the test provider so missing DATABASE_URL values do not trigger side effects.
function getProvider(): Promise<TestkitProvider> {
  if (providerPromise) {
    return providerPromise;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      'Cannot initialize the repository testkit provider without DATABASE_URL.',
    );
  }

  pool = new Pool({ connectionString: databaseUrl });
  const activePool = pool;
  providerPromise = createTestkitProvider({
    connectionFactory: () => activePool.connect(),
    resourceFactory: async (connection, fixtures) =>
      createPgTestkitClient({
        connectionFactory: () => connection,
        tableRows: fixtures,
        ddl: { directories: ddlDirectories },
      }),
    releaseResource: async (client) => {
      await client.close();
    },
    disposeConnection: async (connection) => {
      if (typeof connection.release === 'function') {
        connection.release();
        return;
      }
      if (typeof connection.end === 'function') {
        await connection.end();
      }
    },
  });

  return providerPromise;
}

afterAll(async () => {
  // Close resources only when initialization actually happened.
  if (!providerPromise) {
    return;
  }

  const provider = await providerPromise;
  await provider.close();
  if (pool) {
    await pool.end();
  }
});

function buildUserAccounts(): TestRowMap['public.user_account'][] {
  return [
    {
      user_account_id: 1,
      username: 'alpha',
      email: 'alpha@example.com',
      display_name: 'Alpha Tester',
      created_at: '2025-12-01T08:00:00Z',
      updated_at: '2025-12-01T09:00:00Z',
    },
    {
      user_account_id: 2,
      username: 'bravo',
      email: 'bravo@example.com',
      display_name: 'Bravo Builder',
      created_at: '2025-12-02T10:00:00Z',
      updated_at: '2025-12-02T11:00:00Z',
    },
  ];
}

function buildUserProfiles(): TestRowMap['public.user_profile'][] {
  return [
    {
      profile_id: 101,
      user_account_id: 1,
      bio: 'Lead engineer and mapper advocate.',
      website: 'https://example.com',
      verified: true,
    },
  ];
}

function buildFixtures(): TableFixture[] {
  return [
    tableFixture(
      'public.user_account',
      buildUserAccounts(),
      tableSchemas['public.user_account'],
    ),
    tableFixture(
      'public.user_profile',
      buildUserProfiles(),
      tableSchemas['public.user_profile'],
    ),
  ];
}

describeUserProfile(suiteTitle, () => {
  test('listUserProfiles hydrates optional profiles', async () => {
    const fixtures = buildFixtures();
    const provider = await getProvider();
    await provider.withRepositoryFixture(fixtures, async (client) => {
      const result = await listUserProfiles(client);
      expect(result).toEqual([
        {
          userAccountId: 1,
          username: 'alpha',
          email: 'alpha@example.com',
          displayName: 'Alpha Tester',
          createdAt: new Date('2025-12-01T08:00:00Z'),
          updatedAt: new Date('2025-12-01T09:00:00Z'),
          profile: {
            profileId: 101,
            userAccountId: 1,
            bio: 'Lead engineer and mapper advocate.',
            website: 'https://example.com',
            verified: true,
          },
        },
        {
          userAccountId: 2,
          username: 'bravo',
          email: 'bravo@example.com',
          displayName: 'Bravo Builder',
          createdAt: new Date('2025-12-02T10:00:00Z'),
          updatedAt: new Date('2025-12-02T11:00:00Z'),
          profile: undefined,
        },
      ]);
    });
  });
});
