import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';
import {
  executeSmokeQuerySpec,
  type SmokeQueryParams,
  type SmokeQueryResult
} from './queries/smoke/boundary.js';

export interface SmokeRequest {
  user_id: number;
}

export interface SmokeResponse {
  user_id: number;
  email: string;
}

function parseRequest(raw: unknown): SmokeRequest {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('SmokeRequest must be an object.');
  }
  const value = (raw as Record<string, unknown>).user_id;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('SmokeRequest.user_id must be a positive integer.');
  }
  return { user_id: value };
}

function toQueryParams(request: SmokeRequest): SmokeQueryParams {
  return {
    user_id: request.user_id
  };
}

function fromQueryResult(result: SmokeQueryResult): SmokeResponse {
  return {
    user_id: result.user_id,
    email: result.email
  };
}

export async function executeSmokeEntrySpec(
  executor: FeatureQueryExecutor,
  rawRequest: unknown
): Promise<SmokeResponse> {
  const request = parseRequest(rawRequest);
  const result = await executeSmokeQuerySpec(executor, toQueryParams(request));
  return fromQueryResult(result);
}
