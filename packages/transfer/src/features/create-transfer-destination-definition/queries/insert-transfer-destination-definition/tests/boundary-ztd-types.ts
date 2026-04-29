import type { QuerySpecZtdCase } from '#tests/support/ztd/case-types.js';

export type InsertTransferDestinationDefinitionBeforeDb = { public: { transfer_destination_definition: readonly { transfer_destination_definition_name?: unknown; description?: unknown; destination_table_name?: unknown; destination_columns?: unknown; destination_key_definition?: unknown; sequence_expression_definition?: unknown; update_transfer_policy?: unknown; delete_transfer_policy?: unknown; sign_inversion_columns?: unknown; red_transfer_source_columns?: unknown; diff_compare_excluded_columns?: unknown; note?: unknown; transfer_destination_definition_id?: unknown; created_at?: unknown; updated_at?: unknown }[] } };
export type InsertTransferDestinationDefinitionInput = { transfer_destination_definition_name: unknown; description: unknown; destination_table_name: unknown; destination_columns: unknown; destination_key_definition: unknown; sequence_expression_definition: unknown; update_transfer_policy: unknown; delete_transfer_policy: unknown; sign_inversion_columns: unknown; red_transfer_source_columns: unknown; diff_compare_excluded_columns: unknown; note: unknown };
export type InsertTransferDestinationDefinitionOutput = { transfer_destination_definition_id: unknown; transfer_destination_definition_name: unknown; description: unknown; destination_table_name: unknown; destination_columns: unknown; destination_key_definition: unknown; sequence_expression_definition: unknown; update_transfer_policy: unknown; delete_transfer_policy: unknown; sign_inversion_columns: unknown; red_transfer_source_columns: unknown; diff_compare_excluded_columns: unknown; created_at: unknown; updated_at: unknown; note: unknown };

export type InsertTransferDestinationDefinitionQueryBoundaryZtdCase = QuerySpecZtdCase<
  InsertTransferDestinationDefinitionBeforeDb,
  InsertTransferDestinationDefinitionInput,
  InsertTransferDestinationDefinitionOutput
>;
