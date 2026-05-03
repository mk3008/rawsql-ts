import type { QuerySpecZtdCase } from '#tests/support/ztd/case-types.js';
import type { InsertTransferSettingDestinationDefinitionQueryParams, InsertTransferSettingDestinationDefinitionQueryResult } from '../boundary.js';

export type InsertTransferSettingDestinationDefinitionBeforeDb = { public: { transfer_setting_destination_definition: readonly { transfer_setting_id?: unknown; transfer_destination_definition_id?: unknown; execution_order?: unknown; source_key_definition?: unknown; mapping_definition?: unknown; generated_insert_transfer_sql_body?: unknown; generated_update_transfer_sql_body?: unknown; generated_red_transfer_sql_body?: unknown; generated_delete_transfer_sql_body?: unknown; generated_sql_status?: unknown; generated_sql_error?: unknown; is_enabled?: unknown; note?: unknown; transfer_setting_destination_definition_id?: unknown; created_at?: unknown; updated_at?: unknown }[] } };
export type InsertTransferSettingDestinationDefinitionInput = InsertTransferSettingDestinationDefinitionQueryParams;
export type InsertTransferSettingDestinationDefinitionOutput = InsertTransferSettingDestinationDefinitionQueryResult;

export type InsertTransferSettingDestinationDefinitionQueryBoundaryZtdCase = QuerySpecZtdCase<
  InsertTransferSettingDestinationDefinitionBeforeDb,
  InsertTransferSettingDestinationDefinitionInput,
  InsertTransferSettingDestinationDefinitionOutput
>;
