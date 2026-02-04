import type { SqlClient } from '../db/sql-client';
import { createWriter, type QueryParams } from '@rawsql-ts/sql-contract';

const userAccountTable = 'public.user_account';

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

const createWriterForClient = (client: SqlClient) =>
  createWriter((sql, params: QueryParams) => client.query(sql, params as readonly unknown[]));

/**
 * Inserts a new user account row.
 * @param {SqlClient} client Client proxy that executes SQL statements.
 * @param {NewUserAccount} input The normalized fields for the new account.
 */
export async function insertUserAccount(
  client: SqlClient,
  input: NewUserAccount
): Promise<void> {
  const writer = createWriterForClient(client);
  await writer.insert(userAccountTable, {
    username: input.username,
    email: input.email,
    display_name: input.displayName,
  });
}

/**
 * Updates the display name for an existing account.
 * @param {SqlClient} client Client proxy that executes SQL statements.
 * @param {number} userAccountId The primary key of the account to update.
 * @param {DisplayNameUpdatePayload} payload The new display name payload.
 */
export async function updateDisplayName(
  client: SqlClient,
  userAccountId: number,
  payload: DisplayNameUpdatePayload
): Promise<void> {
  const writer = createWriterForClient(client);
  await writer.update(
    userAccountTable,
    {
      display_name: payload.displayName,
      updated_at: new Date(),
    },
    { user_account_id: userAccountId }
  );
}

/**
 * Removes a user account by its primary key.
 * @param {SqlClient} client Client proxy that executes SQL statements.
 * @param {number} userAccountId The primary key of the account to delete.
 */
export async function removeUserAccount(
  client: SqlClient,
  userAccountId: number
): Promise<void> {
  const writer = createWriterForClient(client);
  await writer.remove(userAccountTable, { user_account_id: userAccountId });
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
