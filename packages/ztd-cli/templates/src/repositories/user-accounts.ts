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

/**
 * DTO that represents a user account with its optional profile information.
 * @property {number} userAccountId The primary key for the user account.
 * @property {string} username The canonical username.
 * @property {string} email The account email address.
 * @property {string} displayName The account display name.
 * @property {Date} createdAt When the account was created.
 * @property {Date} updatedAt When the account was last updated.
 * @property {UserProfileRow} [profile] Optional profile payload joined from user_profile.
 */
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

/**
 * Queries all user accounts together with their associated profiles.
 * @param {SqlClient} client Client proxy that executes the mapper SQL.
 * @returns {Promise<UserAccountWithProfile[]>} The joined account-with-profile rows.
 */
export async function listUserProfiles(
  client: SqlClient,
): Promise<UserAccountWithProfile[]> {
  const mapper = createMapperForClient(client);
  return mapper.query(userProfilesSql, [], userAccountMapping);
}

/**
 * Parameters required to insert a new user account.
 * @property {string} username The requested username.
 * @property {string} email The requested email address.
 * @property {string} displayName The requested display name.
 */
export type NewUserAccount = {
  username: string;
  email: string;
  displayName: string;
};

/**
 * Payload describing the display name change for an existing account.
 * @property {string} displayName The new display name to persist.
 */
export type DisplayNameUpdatePayload = {
  displayName: string;
};

/**
 * Builds an insert statement for the user_account writer.
 * @param {NewUserAccount} input The normalized fields for the new account.
 * @returns {ReturnType<typeof insert>} A well-formed insert statement for the user_account writer.
 */
export function buildInsertUserAccount(
  input: NewUserAccount,
): ReturnType<typeof insert> {
  return insert(userAccountTable, {
    username: input.username,
    email: input.email,
    display_name: input.displayName,
  });
}

/**
 * Builds an update statement that refreshes the display name and timestamp.
 * @param {Key} key The unique key identifying the row to update.
 * @param {DisplayNameUpdatePayload} payload The new display name payload.
 * @returns {ReturnType<typeof update>} A writer update statement that refreshes the display name and updated_at timestamp.
 */
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

/**
 * Builds a delete statement for the specified user account key.
 * @param {Key} key Identifies the row to remove.
 * @returns {ReturnType<typeof remove>} A writer delete statement for the matching user account.
 */
export function buildRemoveUserAccount(key: Key): ReturnType<typeof remove> {
  return remove(userAccountTable, key);
}

/**
 * Column sets that writer tests use to ensure only approved columns are touched.
 * @property {readonly string[]} insertColumns Columns allowed for new account inserts.
 * @property {readonly string[]} updateColumns Columns permitted during updates.
 * @property {readonly string[]} immutableColumns Columns that must remain unchanged.
 */
export const userAccountWriterColumnSets = {
  insertColumns: ['username', 'email', 'display_name'] as const,
  updateColumns: ['display_name', 'updated_at'] as const,
  immutableColumns: ['user_account_id', 'created_at'] as const,
};
