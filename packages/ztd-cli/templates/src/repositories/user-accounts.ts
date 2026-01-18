import type { SqlClient } from '../db/sql-client';
import { createMapper, entity, toRowsExecutor } from '@rawsql-ts/mapper-core';
import { insert, Key, remove, update } from '@rawsql-ts/writer-core';

const userAccountTable = 'public.user_account';

type UserProfileRow = {
  profileId: number;
  userAccountId: number;
  bio: string | null;
  website: string | null;
  verified: boolean;
};

export type UserAccountWithProfile = {
  userAccountId: number;
  username: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
  profile?: UserProfileRow;
};

// Map the joined profile columns so we can hydrate nested objects later.
const profileMapping = entity<UserProfileRow>({
  name: 'userProfile',
  key: 'profileId',
  columnMap: {
    profileId: 'profile_id',
    userAccountId: 'profile_user_account_id',
    bio: 'bio',
    website: 'website',
    verified: 'verified',
  },
});

const userAccountMapping = entity<UserAccountWithProfile>({
  name: 'userAccount',
  key: 'userAccountId',
  columnMap: {
    userAccountId: 'user_account_id',
    username: 'username',
    email: 'email',
    displayName: 'display_name',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}).belongsTo('profile', profileMapping, 'userAccountId', { optional: true });

const userProfilesSql = `
SELECT
  u.user_account_id,
  u.username,
  u.email,
  u.display_name,
  u.created_at,
  u.updated_at,
  p.profile_id,
  p.user_account_id AS profile_user_account_id,
  p.bio,
  p.website,
  p.verified
FROM public.user_account u
LEFT JOIN public.user_profile p ON p.user_account_id = u.user_account_id
ORDER BY u.user_account_id, p.profile_id;
`;

// Build a mapper that can translate snake_case columns into camelCase DTOs.
const createMapperForClient = (client: SqlClient) =>
  createMapper(
    toRowsExecutor((sql, params: unknown[] = []) =>
      client.query<Record<string, unknown>>(sql, params),
    ),
    {
      // The explicit column maps enumerate the nested entity columns while keyTransform handles generic snake_to_camel conversions.
      keyTransform: 'snake_to_camel',
      coerceDates: true,
    },
  );

export async function listUserProfiles(
  client: SqlClient,
): Promise<UserAccountWithProfile[]> {
  const mapper = createMapperForClient(client);
  return mapper.query(userProfilesSql, [], userAccountMapping);
}

export type NewUserAccount = {
  username: string;
  email: string;
  displayName: string;
};

export type DisplayNameUpdatePayload = {
  displayName: string;
};

// Writer helpers keep SQL+params visible and enforce the minimal CUD surface.
export function buildInsertUserAccount(
  input: NewUserAccount,
): ReturnType<typeof insert> {
  return insert(userAccountTable, {
    username: input.username,
    email: input.email,
    display_name: input.displayName,
  });
}

export function buildUpdateDisplayName(
  key: Key,
  payload: DisplayNameUpdatePayload,
): ReturnType<typeof update> {
  return update(
    userAccountTable,
    {
      // Persist the new display name and bump the timestamp along with it.
      display_name: payload.displayName,
      updated_at: new Date(),
    },
    key,
  );
}

export function buildRemoveUserAccount(key: Key): ReturnType<typeof remove> {
  return remove(userAccountTable, key);
}

// Tests consume these lists to verify writer callers stay within the approved columns.
export const userAccountWriterColumnSets = {
  insertColumns: ['username', 'email', 'display_name'] as const,
  updateColumns: ['display_name', 'updated_at'] as const,
  immutableColumns: ['user_account_id', 'created_at'] as const,
};
