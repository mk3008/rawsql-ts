import { z } from 'zod';

import type { FeatureQueryExecutor } from '../../../_shared/featureQueryExecutor.js';
import { loadSqlResource } from '../../../_shared/loadSqlResource.js';

const smokeSqlResource = loadSqlResource(__dirname, 'smoke.sql');

const QueryParamsSchema = z.object({
  user_id: z.number().int().positive()
}).strict();

export type SmokeQueryParams = z.infer<typeof QueryParamsSchema>;

const RowSchema = z.object({
  user_id: z.number().int(),
  email: z.string()
}).strict();

const QueryResultSchema = z.object({
  user_id: z.number().int(),
  email: z.string()
}).strict();

export type SmokeQueryResult = z.infer<typeof QueryResultSchema>;

type SmokeRow = z.infer<typeof RowSchema>;

function parseQueryParams(raw: unknown): SmokeQueryParams {
  return QueryParamsSchema.parse(raw);
}

function parseRow(raw: unknown): SmokeRow {
  return RowSchema.parse(raw);
}

function mapRowToResult(row: SmokeRow): SmokeQueryResult {
  return QueryResultSchema.parse(row);
}

async function loadSingleRow(
  executor: FeatureQueryExecutor,
  sql: string,
  params: Record<string, unknown>
): Promise<SmokeRow> {
  const rows = await executor.query<Record<string, unknown>>(sql, params);
  if (rows.length !== 1) {
    throw new Error('SmokeQuerySpec expected exactly one row.');
  }
  return parseRow(rows[0]);
}

export async function executeSmokeQuerySpec(
  executor: FeatureQueryExecutor,
  rawParams: unknown
): Promise<SmokeQueryResult> {
  const params = parseQueryParams(rawParams);
  const row = await loadSingleRow(executor, smokeSqlResource, params);
  return mapRowToResult(row);
}
