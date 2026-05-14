import type {
  ResolveTransferDestinationDefinitionsBeforeDb,
  ResolveTransferDestinationDefinitionsQueryBoundaryZtdCase
} from '../boundary-ztd-types.js';

const beforeDb = {
  rawsql_transfer: {
    destination_definition: [
      {
        destination_definition_id: '10',
        destination_definition_name: 'journal',
        description: '仕訳転送先',
        destination_table_name: 'public.journal',
        destination_columns: { columns: [{ name: 'journal_id', type: 'bigint' }] },
        destination_key_columns: '{journal_id}',
        sequence_expression_definition: null,
        transfer_model: 'immutable',
        sign_inversion_columns: '{amount}',
        generated_red_transfer_sql_body: '',
        generated_red_transfer_sql_status: 'not_generated',
        generated_red_transfer_sql_error: null,
        created_at: new Date('2026-05-02T00:00:00.000Z'),
        updated_at: new Date('2026-05-02T00:00:00.000Z'),
        note: null
      },
      {
        destination_definition_id: '11',
        destination_definition_name: 'account_balance',
        description: '科目残高転送先',
        destination_table_name: 'public.account_balance',
        destination_columns: { columns: [{ name: 'account_balance_id', type: 'bigint' }] },
        destination_key_columns: '{account_balance_id}',
        sequence_expression_definition: null,
        transfer_model: 'mutable',
        sign_inversion_columns: null,
        generated_red_transfer_sql_body: '',
        generated_red_transfer_sql_status: 'not_generated',
        generated_red_transfer_sql_error: null,
        created_at: new Date('2026-05-02T00:00:00.000Z'),
        updated_at: new Date('2026-05-02T00:00:00.000Z'),
        note: null
      }
    ]
  }
} satisfies ResolveTransferDestinationDefinitionsBeforeDb;

const cases: readonly ResolveTransferDestinationDefinitionsQueryBoundaryZtdCase[] = [
  {
    name: 'resolves selected destination definition names',
    beforeDb,
    input: {
      destination_definition_names: ['journal']
    },
    output: {
      items: [
        {
          destination_definition_id: '10',
          destination_definition_name: 'journal'
        }
      ]
    }
  }
];

export default cases;
