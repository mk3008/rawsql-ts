import type {
  ResolveTransferDestinationDefinitionsBeforeDb,
  ResolveTransferDestinationDefinitionsQueryBoundaryZtdCase
} from '../boundary-ztd-types.js';

const beforeDb = {
  public: {
    transfer_destination_definition: [
      {
        transfer_destination_definition_id: '10',
        transfer_destination_definition_name: 'journal',
        description: '仕訳転送先',
        destination_table_name: 'journal',
        destination_columns: { columns: [{ name: 'journal_id', type: 'bigint' }] },
        destination_key_definition: { keys: ['journal_id'] },
        sequence_expression_definition: null,
        transfer_model: 'immutable',
        sign_inversion_columns: null,
        red_transfer_source_columns: null,
        diff_compare_excluded_columns: null,
        created_at: new Date('2026-05-02T00:00:00.000Z'),
        updated_at: new Date('2026-05-02T00:00:00.000Z'),
        note: null
      },
      {
        transfer_destination_definition_id: '11',
        transfer_destination_definition_name: 'account_balance',
        description: '科目残高転送先',
        destination_table_name: 'account_balance',
        destination_columns: { columns: [{ name: 'account_balance_id', type: 'bigint' }] },
        destination_key_definition: { keys: ['account_balance_id'] },
        sequence_expression_definition: null,
        transfer_model: 'mutable',
        sign_inversion_columns: null,
        red_transfer_source_columns: null,
        diff_compare_excluded_columns: null,
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
          transfer_destination_definition_id: '10',
          transfer_destination_definition_name: 'journal'
        }
      ]
    }
  }
];

export default cases;
