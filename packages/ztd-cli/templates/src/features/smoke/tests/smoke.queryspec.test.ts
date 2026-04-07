import { expect, test } from 'vitest';

import { createStarterPostgresTestkitClient } from '../../../../.ztd/support/postgres-testkit.js';

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
  const client = createStarterPostgresTestkitClient({
    tableDefinitions: usersTableDefinitions,
    tableRows: [{ tableName: 'public.users', rows: usersTableRows }]
  });

  try {
    const result = await client.query('select id, email from users where id = $1', [1]);
    expect(result.rows).toEqual([{ id: 1, email: 'alice@example.com' }]);
  } finally {
    await client.close();
  }
});
