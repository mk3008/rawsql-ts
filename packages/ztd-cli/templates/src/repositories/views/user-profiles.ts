import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { SqlClient } from '../../db/sql-client';
import { createReader, rowMapping } from '@rawsql-ts/sql-contract';

const userProfilesSql = readFileSync(
  path.join(__dirname, '..', '..', 'sql', 'views', 'user-profiles.sql'),
  'utf8'
);

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

const profileMapping = rowMapping<UserProfileRow>({
  name: 'UserProfile',
  key: 'profileId',
  columnMap: {
    profileId: 'profile_id',
    userAccountId: 'profile_user_account_id',
    bio: 'bio',
    website: 'website',
    verified: 'verified',
  },
});

const userAccountMapping = rowMapping<UserAccountWithProfile>({
  name: 'UserAccount',
  key: 'userAccountId',
  columnMap: {
    userAccountId: 'user_account_id',
    username: 'username',
    email: 'email',
    displayName: 'display_name',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}).belongsToOptional('profile', profileMapping, 'userAccountId');

const createReaderForClient = (client: SqlClient) =>
  createReader((sql, params) =>
    client.query<Record<string, unknown>>(sql, params as readonly unknown[])
  );

/**
 * Queries all user accounts together with their associated profiles.
 * @param {SqlClient} client Client proxy that executes the mapper SQL.
 * @returns {Promise<UserAccountWithProfile[]>} The joined account-with-profile rows.
 */
export async function listUserProfiles(
  client: SqlClient
): Promise<UserAccountWithProfile[]> {
  const reader = createReaderForClient(client);
  return reader.bind(userAccountMapping).list(userProfilesSql);
}
