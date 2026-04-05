import { z } from 'zod';

import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';
import {
  executeSmokeQuerySpec,
  type SmokeQueryParams,
  type SmokeQueryResult
} from './queries/smoke/spec.js';

const RequestSchema = z.object({
  user_id: z.number().int().positive()
}).strict();

export type SmokeRequest = z.infer<typeof RequestSchema>;

const ResponseSchema = z.object({
  user_id: z.number().int(),
  email: z.string()
}).strict();

export type SmokeResponse = z.infer<typeof ResponseSchema>;

function parseRequest(raw: unknown): SmokeRequest {
  return RequestSchema.parse(raw);
}

function rejectRequest(request: SmokeRequest): void {
  if (request.user_id <= 0) {
    throw new Error('SmokeRequest.user_id must be a positive integer.');
  }
}

function toQueryParams(request: SmokeRequest): SmokeQueryParams {
  return {
    user_id: request.user_id
  };
}

function fromQueryResult(result: SmokeQueryResult): SmokeResponse {
  return ResponseSchema.parse(result);
}

export async function executeSmokeEntrySpec(
  executor: FeatureQueryExecutor,
  rawRequest: unknown
): Promise<SmokeResponse> {
  const request = parseRequest(rawRequest);
  rejectRequest(request);
  const result = await executeSmokeQuerySpec(executor, toQueryParams(request));
  return fromQueryResult(result);
}
