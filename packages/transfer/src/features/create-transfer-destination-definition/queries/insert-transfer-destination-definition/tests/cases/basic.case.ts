import { expect } from 'vitest';

import type {
  InsertTransferDestinationDefinitionBeforeDb,
  InsertTransferDestinationDefinitionQueryBoundaryZtdCase
} from '../boundary-ztd-types.js';

const emptyBeforeDb = {
  rawsql_transfer: {
    destination_definition: []
  }
} satisfies InsertTransferDestinationDefinitionBeforeDb;

const cases: readonly InsertTransferDestinationDefinitionQueryBoundaryZtdCase[] = [
  {
    name: 'creates journal transfer destination definition',
    beforeDb: emptyBeforeDb,
    input: {
      destination_definition_name: 'journal',
      description: '仕訳転送先',
      destination_table_name: 'public.journal',
      destination_columns: {
        columns: [
          { name: 'journal_id', type: 'bigint' },
          { name: 'journal_date', type: 'date' },
          { name: 'debit_account_code', type: 'text' },
          { name: 'credit_account_code', type: 'text' },
          { name: 'amount', type: 'numeric' },
          { name: 'remarks', type: 'text' }
        ]
      },
      destination_key_columns: ['journal_id'],
      sequence_expression_definition: {
        journal_id: "nextval('journal_seq')"
      },
      transfer_model: 'immutable',
      sign_inversion_columns: ['amount'],
      note: null
    },
    output: {
      destination_definition_id: expect.any(String),
      destination_definition_name: 'journal',
      description: '仕訳転送先',
      destination_table_name: 'public.journal',
      destination_columns: {
        columns: [
          { name: 'journal_id', type: 'bigint' },
          { name: 'journal_date', type: 'date' },
          { name: 'debit_account_code', type: 'text' },
          { name: 'credit_account_code', type: 'text' },
          { name: 'amount', type: 'numeric' },
          { name: 'remarks', type: 'text' }
        ]
      },
      destination_key_columns: ['journal_id'],
      sequence_expression_definition: {
        journal_id: "nextval('journal_seq')"
      },
      transfer_model: 'immutable',
      sign_inversion_columns: ['amount'],
      generated_red_transfer_sql_body: '',
      generated_red_transfer_sql_status: 'not_generated',
      generated_red_transfer_sql_error: null,
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
      note: null
    }
  },
  {
    name: 'creates account balance transfer destination definition',
    beforeDb: emptyBeforeDb,
    input: {
      destination_definition_name: 'account_balance',
      description: '科目残高転送先',
      destination_table_name: 'public.account_balance',
      destination_columns: {
        columns: [
          { name: 'account_balance_id', type: 'bigint' },
          { name: 'balance_date', type: 'date' },
          { name: 'account_code', type: 'text' },
          { name: 'customer_id', type: 'bigint' },
          { name: 'amount', type: 'numeric' },
          { name: 'balance_side', type: 'text' }
        ]
      },
      destination_key_columns: ['account_balance_id'],
      sequence_expression_definition: {
        account_balance_id: "nextval('account_balance_seq')"
      },
      transfer_model: 'immutable',
      sign_inversion_columns: ['amount'],
      note: null
    },
    output: {
      destination_definition_id: expect.any(String),
      destination_definition_name: 'account_balance',
      description: '科目残高転送先',
      destination_table_name: 'public.account_balance',
      destination_columns: {
        columns: [
          { name: 'account_balance_id', type: 'bigint' },
          { name: 'balance_date', type: 'date' },
          { name: 'account_code', type: 'text' },
          { name: 'customer_id', type: 'bigint' },
          { name: 'amount', type: 'numeric' },
          { name: 'balance_side', type: 'text' }
        ]
      },
      destination_key_columns: ['account_balance_id'],
      sequence_expression_definition: {
        account_balance_id: "nextval('account_balance_seq')"
      },
      transfer_model: 'immutable',
      sign_inversion_columns: ['amount'],
      generated_red_transfer_sql_body: '',
      generated_red_transfer_sql_status: 'not_generated',
      generated_red_transfer_sql_error: null,
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
      note: null
    }
  }
];

export default cases;
