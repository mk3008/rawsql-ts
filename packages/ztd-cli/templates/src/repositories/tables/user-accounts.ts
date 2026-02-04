import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { SqlClient } from '../../db/sql-client';

const insertUserAccountSql = readFileSync(
  path.join(__dirname, '..', '..', 'sql', 'user_account', 'insert_user_account.sql'),
  'utf8'
);
const updateDisplayNameSql = readFileSync(
  path.join(__dirname, '..', '..', 'sql', 'user_account', 'update_display_name.sql'),
  'utf8'
);
const deleteUserAccountSql = readFileSync(
  path.join(__dirname, '..', '..', 'sql', 'user_account', 'delete_user_account.sql'),
  'utf8'
);

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
 * Repository helper that executes SQL-first user account CRUD.
 * @property {(input: NewUserAccount) => Promise<void>} insertUserAccount Inserts a new user account row.
 * @property {(userAccountId: number, payload: DisplayNameUpdatePayload) => Promise<void>} updateDisplayName Updates the display name for an account.
 * @property {(userAccountId: number) => Promise<void>} removeUserAccount Removes an account by primary key.
 */
export type UserAccountRepository = {
  insertUserAccount: (input: NewUserAccount) => Promise<void>;
  updateDisplayName: (userAccountId: number, payload: DisplayNameUpdatePayload) => Promise<void>;
  removeUserAccount: (userAccountId: number) => Promise<void>;
};

const createExecutor = (client: SqlClient) =>
  (sql: string, params?: Record<string, unknown>) => client.query(sql, params);

/**
 * Creates a SQL-first repository for user account CRUD.
 * @param {SqlClient} client Client proxy that executes SQL statements.
 * @returns {UserAccountRepository} Repository helpers bound to the provided client.
 */
export const createUserAccountRepository = (client: SqlClient): UserAccountRepository => {
  const execute = createExecutor(client);

  return {
    insertUserAccount: async (input: NewUserAccount) => {
      await execute(insertUserAccountSql, {
        username: input.username,
        email: input.email,
        display_name: input.displayName,
      });
    },
    updateDisplayName: async (userAccountId: number, payload: DisplayNameUpdatePayload) => {
      await execute(updateDisplayNameSql, {
        user_account_id: userAccountId,
        display_name: payload.displayName,
      });
    },
    removeUserAccount: async (userAccountId: number) => {
      await execute(deleteUserAccountSql, {
        user_account_id: userAccountId,
      });
    },
  };
};
