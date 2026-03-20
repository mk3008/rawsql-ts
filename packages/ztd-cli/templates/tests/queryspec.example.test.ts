import { expect, test } from 'vitest';

type QuerySpec<TParams extends readonly unknown[], TRow> = {
  id: string;
  sqlFile: string;
  params: {
    shape: 'positional';
    example: TParams;
  };
  output: {
    mapping: {
      name: string;
      key: string;
      columnMap: Record<string, string>;
    };
    validate?: (value: unknown) => TRow;
    example: TRow;
  };
  notes: string;
};

type CatalogExecutorOptions = {
  loader: {
    load(sqlFile: string): Promise<string>;
  };
  executor: (sql: string, params: readonly unknown[]) => Promise<Record<string, unknown>[]>;
};

function rowMapping(mapping: { name: string; key: string; columnMap: Record<string, string> }) {
  return mapping;
}

function createCatalogExecutor({ loader, executor }: CatalogExecutorOptions) {
  return {
    async list<TParams extends readonly unknown[], TRow>(spec: QuerySpec<TParams, TRow>, params: TParams) {
      const sql = await loader.load(spec.sqlFile);
      const rows = await executor(sql, params);
      return rows.map((value) => (spec.output.validate ? spec.output.validate(value) : (value as TRow)));
    }
  };
}

type UserSummaryRow = {
  userId: string;
  email: string;
  displayName: string;
  isActive: boolean;
};

const listActiveUsersSpec: QuerySpec<[boolean], UserSummaryRow> = {
  id: 'users.list-active',
  sqlFile: 'src/sql/users/list-active-users.sql',
  params: {
    shape: 'positional',
    example: [true] as [boolean]
  },
  output: {
    mapping: rowMapping({
      name: 'UserSummary',
      key: 'userId',
      columnMap: {
        userId: 'user_id',
        email: 'email',
        displayName: 'display_name',
        isActive: 'is_active'
      }
    }),
    validate: (value) => {
      const row = value as {
        user_id: unknown;
        email: unknown;
        display_name: unknown;
        is_active: unknown;
      };
      return {
        userId: String(row.user_id),
        email: String(row.email),
        displayName: String(row.display_name),
        isActive: Boolean(row.is_active)
      };
    },
    example: {
      userId: 'user-1',
      email: 'alice@example.com',
      displayName: 'Alice',
      isActive: true
    }
  },
  notes: 'Use this as the sample when you add the first users QuerySpec.'
};

test('queryspec example keeps users SQL, rowMapping, and CatalogExecutor aligned', async () => {
  const loadedSql: string[] = [];
  const executedSql: Array<{ sql: string; params: readonly unknown[] }> = [];

  const executor = createCatalogExecutor({
    loader: {
      async load(sqlFile: string) {
        loadedSql.push(sqlFile);
        return 'select user_id, email, display_name, is_active from users where is_active = :is_active order by user_id';
      }
    },
    executor: async (sql, params) => {
      executedSql.push({ sql, params });
      return [
        {
          user_id: 'user-1',
          email: 'alice@example.com',
          display_name: 'Alice',
          is_active: true
        }
      ];
    }
  });

  const rows = await executor.list(listActiveUsersSpec, [true]);

  expect(loadedSql).toEqual(['src/sql/users/list-active-users.sql']);
  expect(executedSql).toEqual([
    {
      sql: 'select user_id, email, display_name, is_active from users where is_active = :is_active order by user_id',
      params: [true]
    }
  ]);
  expect(rows).toEqual([
    {
      userId: 'user-1',
      email: 'alice@example.com',
      displayName: 'Alice',
      isActive: true
    }
  ]);
  expect(
    listActiveUsersSpec.output.validate?.({
      user_id: 'user-1',
      email: 'alice@example.com',
      display_name: 'Alice',
      is_active: true
    })
  ).toEqual(listActiveUsersSpec.output.example);
});
