import { describe, expect, test } from 'vitest';
import type { SqlClient } from '../src/db/sql-client';
import { createUserProfilesRepository } from '../src/repositories/views/user-profiles';

const sampleRows = [
  {
    user_account_id: 1,
    username: 'alpha',
    email: 'alpha@example.com',
    display_name: 'Alpha Tester',
    created_at: '2025-12-01T08:00:00Z',
    updated_at: '2025-12-01T09:00:00Z',
    profile_id: 101,
    profile_user_account_id: 1,
    bio: 'Lead engineer and mapper advocate.',
    website: 'https://example.com',
    verified: true,
  },
  {
    user_account_id: 2,
    username: 'bravo',
    email: 'bravo@example.com',
    display_name: 'Bravo Builder',
    created_at: '2025-12-02T10:00:00Z',
    updated_at: '2025-12-02T11:00:00Z',
    profile_id: null,
    profile_user_account_id: null,
    bio: null,
    website: null,
    verified: null,
  },
];

function createStubClient(rows: typeof sampleRows): SqlClient {
  return {
    query: async <T extends Record<string, unknown>>(_sql: string, _values?: readonly unknown[] | Record<string, unknown>) =>
      rows as T[],
  };
}

describe('listUserProfiles', () => {
  test('maps joined rows to camelCase DTOs', async () => {
    const client = createStubClient(sampleRows);
    const repository = createUserProfilesRepository(client);
    const actual = await repository.listUserProfiles();
    expect(actual).toEqual([
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
