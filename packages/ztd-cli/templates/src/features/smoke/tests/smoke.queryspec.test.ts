import { createPostgresTestkitClient } from '@rawsql-ts/testkit-postgres';
import { Pool } from 'pg';
import { expect, test } from 'vitest';

const usersTableDefinitions = [
  {
    name: 'public.users',
    columns: [
      { name: 'id', typeName: 'int', required: true },
      { name: 'email', typeName: 'text', required: true }
    ]
  }
];

const usersTableRows = [
  { id: 1, email: 'alice@example.com' }
];

test('smoke starter DB path connects through testkit-postgres and resolves the starter schema', async () => {
  const connectionString = process.env.ZTD_TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Set ZTD_DB_PORT in .env before running src/features/smoke/tests/smoke.queryspec.test.ts.'
    );
  }

  const pool = new Pool({ connectionString });
  const client = createPostgresTestkitClient({
    queryExecutor: (sql, params) => pool.query(sql, params as unknown[]),
    defaultSchema: 'public',
    searchPath: ['public'],
    tableDefinitions: usersTableDefinitions,
    tableRows: [{ tableName: 'public.users', rows: usersTableRows }]
  });

  try {
    const result = await client.query('select id, email from users where id = $1', [1]);
    expect(result.rows).toEqual([{ id: 1, email: 'alice@example.com' }]);
  } finally {
    await client.close();
    await pool.end();
  }
});
