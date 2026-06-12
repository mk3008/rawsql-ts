import type { CreateTransferSettingWorkflowResult } from './workflow.js';

export type CreateTransferSettingResult = {
  transferSetting: {
    transferSettingId: string;
    name: string;
    description: string | null;
    sourceSqlBody: string;
    sourceSqlHash: string;
    sourceKeyDefinition: Record<string, unknown>;
    sourceSqlAnalysisResult: Record<string, unknown> | null;
    searchConditionAnalysisResult: Record<string, unknown> | null;
    sourceSqlAnalysisStatus: 'not_analyzed' | 'success' | 'failed';
    sourceSqlAnalysisError: string | null;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    note: string | null;
  };
  destinations: Array<{
    transferSettingDestinationDefinitionId: string;
    transferSettingId: string;
    transferDestinationDefinitionId: string;
    executionOrder: number;
    destinationKeyMapping: Record<string, unknown>;
    mappingDefinition: Record<string, unknown>;
    diffCompareExcludedColumns: Record<string, unknown> | null;
    generatedInsertTransferSqlBody: string;
    generatedUpdateTransferSqlBody: string;
    generatedDeleteTransferSqlBody: string;
    generatedSqlStatus: 'not_generated' | 'success' | 'failed';
    generatedSqlError: string | null;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    note: string | null;
  }>;
};

export function buildResult(
  created: CreateTransferSettingWorkflowResult,
): CreateTransferSettingResult {
  return {
    transferSetting: {
      transferSettingId: created.transferSetting.setting_id,
      name: created.transferSetting.setting_name,
      description: created.transferSetting.description,
      sourceSqlBody: created.transferSetting.source_sql_body,
      sourceSqlHash: created.transferSetting.source_sql_hash,
      sourceKeyDefinition: created.transferSetting.source_key_definition,
      sourceSqlAnalysisResult: created.transferSetting.source_sql_analysis_result,
      searchConditionAnalysisResult: created.transferSetting.search_condition_analysis_result,
      sourceSqlAnalysisStatus: created.transferSetting.source_sql_analysis_status,
      sourceSqlAnalysisError: created.transferSetting.source_sql_analysis_error,
      isEnabled: created.transferSetting.is_enabled,
      createdAt: created.transferSetting.created_at,
      updatedAt: created.transferSetting.updated_at,
      note: created.transferSetting.note,
    },
    destinations: created.destinations.map((destination) => ({
      transferSettingDestinationDefinitionId:
        destination.destination_link_id,
      transferSettingId: destination.setting_id,
      transferDestinationDefinitionId: destination.destination_definition_id,
      executionOrder: destination.execution_order,
      destinationKeyMapping: destination.destination_key_mapping,
      mappingDefinition: destination.mapping_definition,
      diffCompareExcludedColumns: destination.diff_compare_excluded_columns,
      generatedInsertTransferSqlBody: destination.generated_insert_transfer_sql_body,
      generatedUpdateTransferSqlBody: destination.generated_update_transfer_sql_body,
      generatedDeleteTransferSqlBody: destination.generated_delete_transfer_sql_body,
      generatedSqlStatus: destination.generated_sql_status,
      generatedSqlError: destination.generated_sql_error,
      isEnabled: destination.is_enabled,
      createdAt: destination.created_at,
      updatedAt: destination.updated_at,
      note: destination.note,
    })),
  };
}
