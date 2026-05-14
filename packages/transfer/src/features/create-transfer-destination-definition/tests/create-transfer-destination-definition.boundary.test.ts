import { expect, test } from 'vitest';

import {
  executeCreateTransferDestinationDefinitionEntrySpec,
  type CreateTransferDestinationDefinitionInput,
} from '../boundary.js';
import type { FeatureQueryExecutor } from '../../_shared/featureQueryExecutor.js';

const validInput: CreateTransferDestinationDefinitionInput = {
  name: 'journal',
  description: '仕訳転送先',
  destinationTableName: 'public.journal',
  destinationColumns: {
    columns: [
      { name: 'journal_id', type: 'bigint' },
      { name: 'amount', type: 'numeric' },
    ],
  },
  destinationKeyColumns: ['journal_id'],
  sequenceExpressionDefinition: {
    journal_id: "nextval('journal_seq')",
  },
  transferModel: 'immutable',
  signInversionColumns: ['amount'],
  note: 'reviewed',
};

test('maps camelCase feature input to snake_case query params and response fields', async () => {
  const seenParams: Record<string, unknown>[] = [];
  const executor: FeatureQueryExecutor = {
    async query<T = unknown>(_sql: string, params: Record<string, unknown>): Promise<T[]> {
      seenParams.push(params);
      return [
        {
          destination_definition_id: '1',
          destination_definition_name: 'journal',
          description: '仕訳転送先',
          destination_table_name: 'public.journal',
          destination_columns: validInput.destinationColumns,
          destination_key_columns: validInput.destinationKeyColumns,
          sequence_expression_definition: validInput.sequenceExpressionDefinition,
          transfer_model: 'immutable',
          sign_inversion_columns: validInput.signInversionColumns,
          generated_red_transfer_sql_body: '',
          generated_red_transfer_sql_status: 'not_generated',
          generated_red_transfer_sql_error: null,
          created_at: new Date('2026-04-29T00:00:00.000Z'),
          updated_at: new Date('2026-04-29T00:00:00.000Z'),
          note: 'reviewed',
        },
      ] as T[];
    },
  };

  const result = await executeCreateTransferDestinationDefinitionEntrySpec(executor, validInput);

  expect(seenParams).toEqual([
    {
      destination_definition_name: 'journal',
      description: '仕訳転送先',
      destination_table_name: 'public.journal',
      destination_columns: validInput.destinationColumns,
      destination_key_columns: validInput.destinationKeyColumns,
      sequence_expression_definition: validInput.sequenceExpressionDefinition,
      transfer_model: 'immutable',
      sign_inversion_columns: validInput.signInversionColumns,
      note: 'reviewed',
    },
  ]);
  expect(result).toEqual({
    transferDestinationDefinitionId: '1',
    name: 'journal',
    description: '仕訳転送先',
    destinationTableName: 'public.journal',
    destinationColumns: validInput.destinationColumns,
    destinationKeyColumns: validInput.destinationKeyColumns,
    sequenceExpressionDefinition: validInput.sequenceExpressionDefinition,
    transferModel: 'immutable',
    signInversionColumns: validInput.signInversionColumns,
    generatedRedTransferSqlBody: '',
    generatedRedTransferSqlStatus: 'not_generated',
    generatedRedTransferSqlError: null,
    createdAt: new Date('2026-04-29T00:00:00.000Z'),
    updatedAt: new Date('2026-04-29T00:00:00.000Z'),
    note: 'reviewed',
  });
});

test.each([
  ['empty name', { name: '   ' }],
  ['empty destination table name', { destinationTableName: '   ' }],
  ['unqualified destination table name', { destinationTableName: 'journal' }],
  ['missing destination schema name', { destinationTableName: '.journal' }],
  ['missing destination table name', { destinationTableName: 'public.' }],
  ['too many destination table name parts', { destinationTableName: 'public.journal.extra' }],
  ['empty destination columns', { destinationColumns: { columns: [] } }],
  [
    'duplicate destination column names',
    {
      destinationColumns: {
        columns: [
          { name: 'journal_id', type: 'bigint' },
          { name: 'journal_id', type: 'bigint' },
        ],
      },
    },
  ],
  ['empty destination key columns', { destinationKeyColumns: [] }],
  ['unknown destination key column', { destinationKeyColumns: ['missing_id'] }],
  [
    'unknown sequence expression column',
    { sequenceExpressionDefinition: { missing_id: "nextval('x')" } },
  ],
  ['unknown sign inversion column', { signInversionColumns: ['missing_amount'] }],
  ['invalid transfer model', { transferModel: 'merge' }],
])('rejects invalid input: %s', async (_name, patch) => {
  const executor = createGuardedExecutor();
  await expect(
    executeCreateTransferDestinationDefinitionEntrySpec(executor, {
      ...validInput,
      ...patch,
    }),
  ).rejects.toThrow();
});

function createGuardedExecutor(): FeatureQueryExecutor {
  return {
    async query() {
      throw new Error('Validation failures must not reach the query boundary.');
    },
  };
}
