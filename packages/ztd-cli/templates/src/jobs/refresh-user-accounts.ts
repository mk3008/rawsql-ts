import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { SqlClient } from '../db/sql-client';

const refreshUserAccountsSql = readFileSync(
  path.join(__dirname, '..', 'sql', 'jobs', 'refresh-user-accounts.sql'),
  'utf8'
);

/**
 * Runs the batch job that refreshes user account timestamps.
 * @param {SqlClient} client Client proxy that executes SQL statements.
 */
export async function refreshUserAccounts(client: SqlClient): Promise<void> {
  await client.query(refreshUserAccountsSql);
}
