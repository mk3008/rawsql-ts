import { expect } from 'vitest';

import type {
  InsertTransferSettingDestinationDefinitionBeforeDb,
  InsertTransferSettingDestinationDefinitionQueryBoundaryZtdCase
} from '../boundary-ztd-types.js';

const emptyBeforeDb = {
  public: {
    transfer_setting_destination_definition: []
  }
} satisfies InsertTransferSettingDestinationDefinitionBeforeDb;

const sourceKeyDefinition = {
  keys: [{ name: 'sale_id', sourceColumn: 'sale_id', type: 'bigint' }]
};

const mappingDefinition = {
  columns: {
    journal_date: 'sale_date',
    amount: 'amount'
  }
};

const diffCompareExcludedColumns = {
  columns: ['journal_id', 'created_at']
};

const cases: readonly InsertTransferSettingDestinationDefinitionQueryBoundaryZtdCase[] = [
  {
    name: 'creates transfer setting destination definition with generated SQL placeholders',
    beforeDb: emptyBeforeDb,
    input: {
      transfer_setting_id: '100',
      transfer_destination_definition_id: '10',
      execution_order: 1,
      source_key_definition: sourceKeyDefinition,
      mapping_definition: mappingDefinition,
      diff_compare_excluded_columns: diffCompareExcludedColumns,
      is_enabled: true,
      note: null
    },
    output: {
      transfer_setting_destination_definition_id: expect.any(String),
      transfer_setting_id: '100',
      transfer_destination_definition_id: '10',
      execution_order: 1,
      source_key_definition: sourceKeyDefinition,
      mapping_definition: mappingDefinition,
      diff_compare_excluded_columns: diffCompareExcludedColumns,
      generated_insert_transfer_sql_body: '',
      generated_update_transfer_sql_body: '',
      generated_red_transfer_sql_body: '',
      generated_delete_transfer_sql_body: '',
      generated_sql_status: 'not_generated',
      generated_sql_error: null,
      is_enabled: true,
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
      note: null
    }
  }
];

export default cases;
