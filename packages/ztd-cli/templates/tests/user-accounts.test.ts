import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';
import type { SqlClient } from '../src/db/sql-client';
import { createUserAccountRepository } from '../src/repositories/tables/user-accounts';

type RecordedQuery = {
  sql: string;
  values?: Record<string, unknown> | readonly unknown[];
};

const insertSql = readFileSync(
  path.join(__dirname, '..', 'src', 'sql', 'user_account', 'insert_user_account.sql'),
  'utf8'
);
const updateSql = readFileSync(
  path.join(__dirname, '..', 'src', 'sql', 'user_account', 'update_display_name.sql'),
  'utf8'
);
const deleteSql = readFileSync(
  path.join(__dirname, '..', 'src', 'sql', 'user_account', 'delete_user_account.sql'),
  'utf8'
);

function createStubClient(recorded: RecordedQuery[]): SqlClient {
  return {
    query: async (sql, values) => {
      recorded.push({ sql, values });
      return [];
    },
  };
}

describe('createUserAccountRepository', () => {
  test('executes insert SQL with named params', async () => {
    const recorded: RecordedQuery[] = [];
    const repository = createUserAccountRepository(createStubClient(recorded));

    await repository.insertUserAccount({
      username: 'alpha',
      email: 'alpha@example.com',
      displayName: 'Alpha Tester',
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0].sql).toBe(insertSql);
    expect(recorded[0].values).toEqual({
      username: 'alpha',
      email: 'alpha@example.com',
      display_name: 'Alpha Tester',
    });
  });

  test('executes update SQL with named params', async () => {
    const recorded: RecordedQuery[] = [];
    const repository = createUserAccountRepository(createStubClient(recorded));

    await repository.updateDisplayName(42, { displayName: 'Delta' });

    expect(recorded).toHaveLength(1);
    expect(recorded[0].sql).toBe(updateSql);
    expect(recorded[0].values).toEqual({
      user_account_id: 42,
      display_name: 'Delta',
    });
  });

  test('executes delete SQL with named params', async () => {
    const recorded: RecordedQuery[] = [];
    const repository = createUserAccountRepository(createStubClient(recorded));

    await repository.removeUserAccount(7);

    expect(recorded).toHaveLength(1);
    expect(recorded[0].sql).toBe(deleteSql);
    expect(recorded[0].values).toEqual({
      user_account_id: 7,
    });
  });
});
