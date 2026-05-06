import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import type { FeatureQueryExecutor } from '#features/_shared/featureQueryExecutor.js';
import { loadSqlResource } from '#features/_shared/loadSqlResource.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const insertTransferSettingDestinationDefinitionSqlResource = loadSqlResource(
  __dirname,
  'insert-transfer-setting-destination-definition.sql'
);

const JsonObjectSchema = z.record(z.string(), z.unknown());

const QueryParamsSchema = z.object({
  transfer_setting_id: z.string().min(1),
  transfer_destination_definition_id: z.string().min(1),
  execution_order: z.number().int().positive(),
  source_key_definition: JsonObjectSchema,
  mapping_definition: JsonObjectSchema,
  diff_compare_excluded_columns: JsonObjectSchema.nullable(),
  is_enabled: z.boolean(),
  note: z.string().min(1).nullable()
}).strict();

export type InsertTransferSettingDestinationDefinitionQueryParams = z.infer<typeof QueryParamsSchema>;

const RowSchema = z.object({
  transfer_setting_destination_definition_id: z.coerce.string(),
  transfer_setting_id: z.coerce.string(),
  transfer_destination_definition_id: z.coerce.string(),
  execution_order: z.number().int(),
  source_key_definition: JsonObjectSchema,
  mapping_definition: JsonObjectSchema,
  diff_compare_excluded_columns: JsonObjectSchema.nullable(),
  generated_insert_transfer_sql_body: z.string(),
  generated_update_transfer_sql_body: z.string(),
  generated_red_transfer_sql_body: z.string(),
  generated_delete_transfer_sql_body: z.string(),
  generated_sql_status: z.enum(['not_generated', 'success', 'failed']),
  generated_sql_error: z.string().nullable(),
  is_enabled: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  note: z.string().nullable()
}).strict();

const QueryResultSchema = RowSchema;

export type InsertTransferSettingDestinationDefinitionQueryResult = z.infer<typeof QueryResultSchema>;
export type InsertTransferSettingDestinationDefinitionRow = z.infer<typeof RowSchema>;

function parseQueryParams(raw: unknown): InsertTransferSettingDestinationDefinitionQueryParams {
  return QueryParamsSchema.parse(raw);
}

function parseRow(raw: unknown): InsertTransferSettingDestinationDefinitionRow {
  return RowSchema.parse(raw);
}

async function loadInsertedRow(
  executor: FeatureQueryExecutor,
  sql: string,
  params: Record<string, unknown>
): Promise<InsertTransferSettingDestinationDefinitionRow> {
  const rows = await executor.query<Record<string, unknown>>(sql, params);
  if (rows.length !== 1) {
    throw new Error('Expected exactly one inserted transfer setting destination definition row.');
  }
  return parseRow(rows[0]);
}

export async function executeInsertTransferSettingDestinationDefinitionQuerySpec(
  executor: FeatureQueryExecutor,
  rawParams: unknown
): Promise<InsertTransferSettingDestinationDefinitionQueryResult> {
  const params = parseQueryParams(rawParams);
  return QueryResultSchema.parse(
    await loadInsertedRow(executor, insertTransferSettingDestinationDefinitionSqlResource, params)
  );
}
