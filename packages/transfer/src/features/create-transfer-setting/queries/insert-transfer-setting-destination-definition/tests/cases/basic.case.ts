import { expect } from 'vitest';

import type {
  InsertTransferSettingDestinationDefinitionBeforeDb,
  InsertTransferSettingDestinationDefinitionQueryBoundaryZtdCase
} from '../boundary-ztd-types.js';

const emptyBeforeDb = {
  rawsql_transfer: {
    destination_link: []
  }
} satisfies InsertTransferSettingDestinationDefinitionBeforeDb;

const destinationKeyMapping = {
  sourceKey: ['sale_id'],
  destinationKey: [{ name: 'journal_id', sourceColumn: 'journal_id' }]
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
      setting_id: '100',
      destination_definition_id: '10',
      execution_order: 1,
      destination_key_mapping: destinationKeyMapping,
      mapping_definition: mappingDefinition,
      diff_compare_excluded_columns: diffCompareExcludedColumns,
      is_enabled: true,
      note: null
    },
    output: {
      destination_link_id: expect.any(String),
      setting_id: '100',
      destination_definition_id: '10',
      execution_order: 1,
      destination_key_mapping: destinationKeyMapping,
      mapping_definition: mappingDefinition,
      diff_compare_excluded_columns: diffCompareExcludedColumns,
      generated_insert_transfer_sql_body: '',
      generated_update_transfer_sql_body: '',
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
