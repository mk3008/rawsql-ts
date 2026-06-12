import type { QuerySpecZtdCase } from '#tests/support/ztd/case-types.js';
import type { InsertTransferSettingDestinationDefinitionQueryParams, InsertTransferSettingDestinationDefinitionQueryResult } from '../boundary.js';

export type InsertTransferSettingDestinationDefinitionBeforeDb = { rawsql_transfer: { destination_link: readonly { setting_id?: unknown; destination_definition_id?: unknown; execution_order?: unknown; destination_key_mapping?: unknown; mapping_definition?: unknown; generated_insert_transfer_sql_body?: unknown; generated_update_transfer_sql_body?: unknown; generated_delete_transfer_sql_body?: unknown; generated_sql_status?: unknown; generated_sql_error?: unknown; is_enabled?: unknown; note?: unknown; destination_link_id?: unknown; created_at?: unknown; updated_at?: unknown }[] } };
export type InsertTransferSettingDestinationDefinitionInput = InsertTransferSettingDestinationDefinitionQueryParams;
export type InsertTransferSettingDestinationDefinitionOutput = InsertTransferSettingDestinationDefinitionQueryResult;

export type InsertTransferSettingDestinationDefinitionQueryBoundaryZtdCase = QuerySpecZtdCase<
  InsertTransferSettingDestinationDefinitionBeforeDb,
  InsertTransferSettingDestinationDefinitionInput,
  InsertTransferSettingDestinationDefinitionOutput
>;
