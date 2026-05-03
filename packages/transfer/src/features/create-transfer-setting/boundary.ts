import type { FeatureQueryExecutor } from '../_shared/featureQueryExecutor.js';
import * as input from './input.js';
import * as output from './output.js';
import * as workflow from './workflow.js';

export type { CreateTransferSettingInput } from './input.js';
export type { CreateTransferSettingResult } from './output.js';

/**
 * Creates a transfer setting and its destination links.
 *
 * Review order:
 * 1. parse input
 * 2. execute workflow
 * 3. build output
 *
 * SQL generation is intentionally deferred in this issue.
 */
export async function execute(
  executor: FeatureQueryExecutor,
  rawRequest: unknown
): Promise<output.CreateTransferSettingResult> {
  const request = input.parseRequest(rawRequest);
  const created = await workflow.execute(executor, request);
  return output.buildResult(created);
}
