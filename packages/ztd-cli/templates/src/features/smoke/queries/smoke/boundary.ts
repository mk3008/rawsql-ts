import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FeatureQueryExecutor } from '#features/_shared/featureQueryExecutor.js';
import { loadSqlResource } from '#features/_shared/loadSqlResource.js';

const smokeSqlResource = loadSqlResource(dirname(fileURLToPath(import.meta.url)), 'smoke.sql');

export interface SmokeQueryParams extends Record<string, unknown> {
  user_id: number;
}

export interface SmokeQueryResult {
  user_id: number;
  email: string;
}

type SmokeRow = {
  user_id: number | string;
  email: string;
};

function parseQueryParams(raw: unknown): SmokeQueryParams {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('SmokeQueryParams must be an object.');
  }
  const value = (raw as Record<string, unknown>).user_id;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('SmokeQueryParams.user_id must be a positive integer.');
  }
  return { user_id: value };
}

function parseRow(raw: unknown): SmokeRow {
  return raw as SmokeRow;
}

function mapRowToResult(row: SmokeRow): SmokeQueryResult {
  return {
    user_id: Number(row.user_id),
    email: row.email
  };
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
