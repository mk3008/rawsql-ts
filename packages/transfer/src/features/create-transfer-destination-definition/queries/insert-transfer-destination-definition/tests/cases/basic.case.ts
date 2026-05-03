import { expect } from 'vitest';

import type {
  InsertTransferDestinationDefinitionBeforeDb,
  InsertTransferDestinationDefinitionQueryBoundaryZtdCase
} from '../boundary-ztd-types.js';

const emptyBeforeDb = {
  public: {
    transfer_destination_definition: []
  }
} satisfies InsertTransferDestinationDefinitionBeforeDb;

const cases: readonly InsertTransferDestinationDefinitionQueryBoundaryZtdCase[] = [
  {
    name: 'creates journal transfer destination definition',
    beforeDb: emptyBeforeDb,
    input: {
      transfer_destination_definition_name: 'journal',
      description: '仕訳転送先',
      destination_table_name: 'journal',
      destination_columns: {
        columns: [
          { name: 'journal_id', type: 'bigint', role: 'key' },
          { name: 'journal_date', type: 'date' },
          { name: 'debit_account_code', type: 'text' },
          { name: 'credit_account_code', type: 'text' },
          { name: 'amount', type: 'numeric', role: 'amount' },
          { name: 'remarks', type: 'text' }
        ]
      },
      destination_key_definition: {
        keys: ['journal_id']
      },
      sequence_expression_definition: {
        journal_id: "nextval('journal_seq')"
      },
      transfer_model: 'immutable',
      sign_inversion_columns: {
        columns: ['amount']
      },
      red_transfer_source_columns: {
        columns: ['journal_date', 'debit_account_code', 'credit_account_code', 'amount', 'remarks']
      },
      diff_compare_excluded_columns: {
        columns: ['journal_id']
      },
      note: null
    },
    output: {
      transfer_destination_definition_id: expect.any(String),
      transfer_destination_definition_name: 'journal',
      description: '仕訳転送先',
      destination_table_name: 'journal',
      destination_columns: {
        columns: [
          { name: 'journal_id', type: 'bigint', role: 'key' },
          { name: 'journal_date', type: 'date' },
          { name: 'debit_account_code', type: 'text' },
          { name: 'credit_account_code', type: 'text' },
          { name: 'amount', type: 'numeric', role: 'amount' },
          { name: 'remarks', type: 'text' }
        ]
      },
      destination_key_definition: {
        keys: ['journal_id']
      },
      sequence_expression_definition: {
        journal_id: "nextval('journal_seq')"
      },
      transfer_model: 'immutable',
      sign_inversion_columns: {
        columns: ['amount']
      },
      red_transfer_source_columns: {
        columns: ['journal_date', 'debit_account_code', 'credit_account_code', 'amount', 'remarks']
      },
      diff_compare_excluded_columns: {
        columns: ['journal_id']
      },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
      note: null
    }
  },
  {
    name: 'creates account balance transfer destination definition',
    beforeDb: emptyBeforeDb,
    input: {
      transfer_destination_definition_name: 'account_balance',
      description: '科目残高転送先',
      destination_table_name: 'account_balance',
      destination_columns: {
        columns: [
          { name: 'account_balance_id', type: 'bigint', role: 'key' },
          { name: 'balance_date', type: 'date' },
          { name: 'account_code', type: 'text' },
          { name: 'customer_id', type: 'bigint' },
          { name: 'amount', type: 'numeric', role: 'amount' },
          { name: 'balance_side', type: 'text' }
        ]
      },
      destination_key_definition: {
        keys: ['account_balance_id']
      },
      sequence_expression_definition: {
        account_balance_id: "nextval('account_balance_seq')"
      },
      transfer_model: 'immutable',
      sign_inversion_columns: {
        columns: ['amount']
      },
      red_transfer_source_columns: {
        columns: ['balance_date', 'account_code', 'customer_id', 'amount', 'balance_side']
      },
      diff_compare_excluded_columns: {
        columns: ['account_balance_id']
      },
      note: null
    },
    output: {
      transfer_destination_definition_id: expect.any(String),
      transfer_destination_definition_name: 'account_balance',
      description: '科目残高転送先',
      destination_table_name: 'account_balance',
      destination_columns: {
        columns: [
          { name: 'account_balance_id', type: 'bigint', role: 'key' },
          { name: 'balance_date', type: 'date' },
          { name: 'account_code', type: 'text' },
          { name: 'customer_id', type: 'bigint' },
          { name: 'amount', type: 'numeric', role: 'amount' },
          { name: 'balance_side', type: 'text' }
        ]
      },
      destination_key_definition: {
        keys: ['account_balance_id']
      },
      sequence_expression_definition: {
        account_balance_id: "nextval('account_balance_seq')"
      },
      transfer_model: 'immutable',
      sign_inversion_columns: {
        columns: ['amount']
      },
      red_transfer_source_columns: {
        columns: ['balance_date', 'account_code', 'customer_id', 'amount', 'balance_side']
      },
      diff_compare_excluded_columns: {
        columns: ['account_balance_id']
      },
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
      note: null
    }
  }
];

export default cases;
