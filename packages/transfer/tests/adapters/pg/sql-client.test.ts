import { describe, expect, test } from 'vitest';

import { fromPg } from '../../../src/adapters/pg/sql-client.js';

describe('fromPg', () => {
  test('compiles named parameters to node-postgres placeholders', async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const client = fromPg({
      async query(text, values) {
        calls.push({ text, values });
        return { rows: [{ destination_definition_id: '1' }] };
      },
    });

    const rows = await client.query<{ destination_definition_id: string }>(
      'select * from transfer_destination_definition where destination_definition_name = any(:names) and is_enabled = :enabled',
      { names: ['journal', 'ledger'], enabled: true },
    );

    expect(rows).toEqual([{ destination_definition_id: '1' }]);
    expect(calls).toEqual([
      {
        text: 'select * from transfer_destination_definition where destination_definition_name = any($1) and is_enabled = $2',
        values: [['journal', 'ledger'], true],
      },
    ]);
  });
});
