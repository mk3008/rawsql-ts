import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import type { FeatureQueryExecutor } from '#features/_shared/featureQueryExecutor.js';
import { loadSqlResource } from '#features/_shared/loadSqlResource.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const insertTransferDestinationDefinitionSqlResource = loadSqlResource(
  __dirname,
  'insert-transfer-destination-definition.sql'
);

const JsonObjectSchema = z.record(z.string(), z.unknown());

const QueryParamsSchema = z.object({
  transfer_destination_definition_name: z.string().min(1),
  description: z.string().min(1).nullable(),
  destination_table_name: z.string().min(1),
  destination_columns: JsonObjectSchema,
  destination_key_definition: JsonObjectSchema,
  sequence_expression_definition: JsonObjectSchema.nullable(),
  transfer_model: z.enum(['immutable', 'mutable']),
  sign_inversion_columns: JsonObjectSchema.nullable(),
  red_transfer_source_columns: JsonObjectSchema.nullable(),
  diff_compare_excluded_columns: JsonObjectSchema.nullable(),
  note: z.string().min(1).nullable()
}).strict();

export type InsertTransferDestinationDefinitionQueryParams = z.infer<typeof QueryParamsSchema>;

const RowSchema = z.object({
  transfer_destination_definition_id: z.coerce.string(),
  transfer_destination_definition_name: z.string(),
  description: z.string().nullable(),
  destination_table_name: z.string(),
  destination_columns: JsonObjectSchema,
  destination_key_definition: JsonObjectSchema,
  sequence_expression_definition: JsonObjectSchema.nullable(),
  transfer_model: z.enum(['immutable', 'mutable']),
  sign_inversion_columns: JsonObjectSchema.nullable(),
  red_transfer_source_columns: JsonObjectSchema.nullable(),
  diff_compare_excluded_columns: JsonObjectSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  note: z.string().nullable()
}).strict();

const QueryResultSchema = RowSchema;

export type InsertTransferDestinationDefinitionQueryResult = z.infer<typeof QueryResultSchema>;

type InsertTransferDestinationDefinitionRow = z.infer<typeof RowSchema>;

function parseQueryParams(raw: unknown): InsertTransferDestinationDefinitionQueryParams {
  return QueryParamsSchema.parse(raw);
}

function parseRow(raw: unknown): InsertTransferDestinationDefinitionRow {
  return RowSchema.parse(raw);
}

function mapRowToResult(
  row: InsertTransferDestinationDefinitionRow
): InsertTransferDestinationDefinitionQueryResult {
  return QueryResultSchema.parse(row);
}

async function loadInsertedRow(
  executor: FeatureQueryExecutor,
  sql: string,
  params: Record<string, unknown>
): Promise<InsertTransferDestinationDefinitionRow> {
  const rows = await executor.query<Record<string, unknown>>(sql, params);
  if (rows.length !== 1) {
    throw new Error('Expected exactly one inserted transfer destination definition row.');
  }
  return parseRow(rows[0]);
}

export async function executeInsertTransferDestinationDefinitionQuerySpec(
  executor: FeatureQueryExecutor,
  rawParams: unknown
): Promise<InsertTransferDestinationDefinitionQueryResult> {
  const params = parseQueryParams(rawParams);
  const row = await loadInsertedRow(executor, insertTransferDestinationDefinitionSqlResource, params);
  return mapRowToResult(row);
}
