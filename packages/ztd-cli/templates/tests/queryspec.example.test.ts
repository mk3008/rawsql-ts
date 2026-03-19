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
      const row = value as { user_id: unknown; display_name: unknown };
      return {
        userId: String(row.user_id),
        displayName: String(row.display_name)
      };
    },
    example: {
      userId: 'user-1',
      displayName: 'Alice'
    }
  },
  notes: 'Use this as the sample when you add the first repository-backed QuerySpec.'
};

test('queryspec example keeps SQL, rowMapping, and CatalogExecutor aligned', async () => {
  const loadedSql: string[] = [];
  const executedSql: Array<{ sql: string; params: readonly unknown[] }> = [];

  const executor = createCatalogExecutor({
    loader: {
      async load(sqlFile: string) {
        loadedSql.push(sqlFile);
        return 'select user_id, display_name from "user"';
      }
    },
    executor: async (sql, params) => {
      executedSql.push({ sql, params });
      return [
        {
          user_id: 'user-1',
          display_name: 'Alice'
        }
      ];
    }
  });

  const rows = await executor.list(listActiveUsersSpec, []);

  expect(loadedSql).toEqual(['src/sql/users/list-active-users.sql']);
  expect(executedSql).toEqual([
    {
      sql: 'select user_id, display_name from "user"',
      params: []
    }
  ]);
  expect(rows).toEqual([
    {
      userId: 'user-1',
      displayName: 'Alice'
    }
  ]);
  expect(
    listActiveUsersSpec.output.validate?.({
      user_id: 'user-1',
      display_name: 'Alice'
    })
  ).toEqual(listActiveUsersSpec.output.example);
});
