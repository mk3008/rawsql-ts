import type { QuerySpecZtdCase } from '#tests/support/ztd/case-types.js';
import type { InsertTransferSettingQueryParams, InsertTransferSettingQueryResult } from '../boundary.js';

export type InsertTransferSettingBeforeDb = { public: { transfer_setting: readonly { transfer_setting_name?: unknown; description?: unknown; source_sql_body?: unknown; source_sql_hash?: unknown; source_sql_analysis_result?: unknown; search_condition_analysis_result?: unknown; source_sql_analysis_status?: unknown; source_sql_analysis_error?: unknown; is_enabled?: unknown; note?: unknown; transfer_setting_id?: unknown; created_at?: unknown; updated_at?: unknown }[] } };
export type InsertTransferSettingInput = InsertTransferSettingQueryParams;
export type InsertTransferSettingOutput = InsertTransferSettingQueryResult;

export type InsertTransferSettingQueryBoundaryZtdCase = QuerySpecZtdCase<
  InsertTransferSettingBeforeDb,
  InsertTransferSettingInput,
  InsertTransferSettingOutput
>;
