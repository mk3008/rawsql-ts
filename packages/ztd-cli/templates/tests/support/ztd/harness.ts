import type { QuerySpecZtdCase } from './case-types.js';
import { verifyQuerySpecZtdCase } from './verifier.js';

type QuerySpecExecutor<RowShape extends Record<string, unknown>, Input, Output> = (
  client: QuerySpecExecutorClient<RowShape>,
  input: Input
) => Promise<Output>;

export type QuerySpecExecutorClient<RowShape extends Record<string, unknown>> = {
  query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]>;
};

/**
 * Fixed runner for queryspec ZTD cases.
 *
 * Keep the app-level harness stable and let query-local case files evolve.
 */
export async function runQuerySpecZtdCases<RowShape extends Record<string, unknown>, Input, Output>(
  cases: readonly QuerySpecZtdCase<RowShape, Input, Output>[],
  execute: QuerySpecExecutor<RowShape, Input, Output>
): Promise<void> {
  for (const querySpecCase of cases) {
    await verifyQuerySpecZtdCase(querySpecCase, execute);
  }
}

/**
 * Backward-compatible alias for older templates while the repo migrates to the queryspec-specific vocabulary.
 */
export const runZtdCases = runQuerySpecZtdCases;

export type { QuerySpecZtdCase } from './case-types.js';
export type QuerySpecHarnessClient<RowShape extends Record<string, unknown>> = QuerySpecExecutorClient<RowShape>;
