import { expect, test } from 'vitest';

import { rowMapping, type QuerySpec } from '@rawsql-ts/sql-contract';

type UserProfileRow = {
  userId: string;
  displayName: string;
};

const listActiveUsersSpec: QuerySpec<[], UserProfileRow> = {
  id: 'users.list-active',
  sqlFile: 'src/sql/users/list-active-users.sql',
  params: {
    shape: 'positional',
    example: [] as []
  },
  output: {
    mapping: rowMapping({
      name: 'UserProfile',
      key: 'userId',
      columnMap: {
        userId: 'user_id',
        displayName: 'display_name'
      }
    }),
    validate: (value) => {
      const row = value as { userId: unknown; displayName: unknown };
      return {
        userId: String(row.userId),
        displayName: String(row.displayName)
      };
    },
    example: {
      userId: 'user-1',
      displayName: 'Alice'
    }
  },
  notes: 'Use this as the sample when you add the first repository-backed QuerySpec.'
};

test('queryspec example keeps SQL, rowMapping, and tests aligned', () => {
  expect(listActiveUsersSpec.id).toBe('users.list-active');
  expect(listActiveUsersSpec.sqlFile).toBe('src/sql/users/list-active-users.sql');
  expect(listActiveUsersSpec.output.example.userId).toBe('user-1');
  expect(listActiveUsersSpec.output.validate?.(listActiveUsersSpec.output.example)).toEqual(
    listActiveUsersSpec.output.example
  );
});
