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
  const result = await executeSmokeQuerySpec(executor, toQueryParams(request));
  return fromQueryResult(result);
}
