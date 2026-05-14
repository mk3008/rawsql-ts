import { expect } from 'vitest';

import type {
  InsertTransferSettingBeforeDb,
  InsertTransferSettingQueryBoundaryZtdCase,
} from '../boundary-ztd-types.js';

const emptyBeforeDb = {
  rawsql_transfer: {
    setting: [],
  },
} satisfies InsertTransferSettingBeforeDb;

const cases: readonly InsertTransferSettingQueryBoundaryZtdCase[] = [
  {
    name: 'creates transfer setting with not analyzed status',
    beforeDb: emptyBeforeDb,
    input: {
      setting_name: 'sales_transfer',
      description: '売上転送',
      source_sql_body: 'select sale_id, amount from sales_transfer_source',
      source_sql_hash: '3b2c66b1596f0dcf1f3c4f65f3c0e15b9b19a7c637f3ea5b47d3c3c9b0d16773',
      source_key_definition: {
        keys: [{ column: 'sale_id', type: 'bigint' }],
      },
      source_sql_analysis_result: null,
      search_condition_analysis_result: null,
      source_sql_analysis_status: 'not_analyzed',
      source_sql_analysis_error: null,
      is_enabled: true,
      note: null,
    },
    output: {
      setting_id: expect.any(String),
      setting_name: 'sales_transfer',
      description: '売上転送',
      source_sql_body: 'select sale_id, amount from sales_transfer_source',
      source_sql_hash: '3b2c66b1596f0dcf1f3c4f65f3c0e15b9b19a7c637f3ea5b47d3c3c9b0d16773',
      source_key_definition: {
        keys: [{ column: 'sale_id', type: 'bigint' }],
      },
      source_sql_analysis_result: null,
      search_condition_analysis_result: null,
      source_sql_analysis_status: 'not_analyzed',
      source_sql_analysis_error: null,
      is_enabled: true,
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
      note: null,
    },
  },
];

export default cases;
