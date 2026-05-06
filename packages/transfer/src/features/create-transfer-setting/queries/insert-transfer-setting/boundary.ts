import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import type { FeatureQueryExecutor } from '#features/_shared/featureQueryExecutor.js';
import { loadSqlResource } from '#features/_shared/loadSqlResource.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const insertTransferSettingSqlResource = loadSqlResource(__dirname, 'insert-transfer-setting.sql');

const JsonObjectSchema = z.record(z.string(), z.unknown());

const QueryParamsSchema = z.object({
  transfer_setting_name: z.string().min(1),
  description: z.string().min(1).nullable(),
  source_sql_body: z.string().min(1),
  source_sql_hash: z.string().min(1),
  source_key_definition: JsonObjectSchema,
  source_sql_analysis_result: JsonObjectSchema.nullable(),
  search_condition_analysis_result: JsonObjectSchema.nullable(),
  source_sql_analysis_status: z.enum(['not_analyzed', 'success', 'failed']),
  source_sql_analysis_error: z.string().min(1).nullable(),
  is_enabled: z.boolean(),
  note: z.string().min(1).nullable()
}).strict();

export type InsertTransferSettingQueryParams = z.infer<typeof QueryParamsSchema>;

const RowSchema = z.object({
  transfer_setting_id: z.coerce.string(),
  transfer_setting_name: z.string(),
  description: z.string().nullable(),
  source_sql_body: z.string(),
  source_sql_hash: z.string(),
  source_key_definition: JsonObjectSchema,
  source_sql_analysis_result: JsonObjectSchema.nullable(),
  search_condition_analysis_result: JsonObjectSchema.nullable(),
  source_sql_analysis_status: z.enum(['not_analyzed', 'success', 'failed']),
  source_sql_analysis_error: z.string().nullable(),
  is_enabled: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  note: z.string().nullable()
}).strict();

const QueryResultSchema = RowSchema;

export type InsertTransferSettingQueryResult = z.infer<typeof QueryResultSchema>;
export type InsertTransferSettingRow = z.infer<typeof RowSchema>;

function parseQueryParams(raw: unknown): InsertTransferSettingQueryParams {
  return QueryParamsSchema.parse(raw);
}

function parseRow(raw: unknown): InsertTransferSettingRow {
  return RowSchema.parse(raw);
}

async function loadInsertedRow(
  executor: FeatureQueryExecutor,
  sql: string,
  params: Record<string, unknown>
): Promise<InsertTransferSettingRow> {
  const rows = await executor.query<Record<string, unknown>>(sql, params);
  if (rows.length !== 1) {
    throw new Error('Expected exactly one inserted transfer setting row.');
  }
  return parseRow(rows[0]);
}

export async function executeInsertTransferSettingQuerySpec(
  executor: FeatureQueryExecutor,
  rawParams: unknown
): Promise<InsertTransferSettingQueryResult> {
  const params = parseQueryParams(rawParams);
  return QueryResultSchema.parse(await loadInsertedRow(executor, insertTransferSettingSqlResource, params));
}
