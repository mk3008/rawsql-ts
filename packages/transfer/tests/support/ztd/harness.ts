import type { QuerySpecTraditionalCase, QuerySpecZtdCase } from './case-types.js';
import {
  verifyQuerySpecTraditionalCase,
  verifyQuerySpecZtdCase,
  type QuerySpecExecutionEvidence
} from './verifier.js';

type QuerySpecExecutor<RowShape extends Record<string, unknown>, Input, Output> = (
  client: QuerySpecExecutorClient<RowShape>,
  input: Input
) => Promise<Output>;

export type QuerySpecExecutorClient<RowShape extends Record<string, unknown>> = {
  query<T = unknown>(sql: string, params: Record<string, unknown>): Promise<T[]>;
};

export interface QuerySpecRunnerOptions {
  mode?: 'ztd' | 'traditional';
}

/**
 * Fixed runner for query-boundary ZTD cases.
 *
 * Keep the app-level harness stable and let query-local case files evolve.
 */
export async function runQuerySpecZtdCases<RowShape extends Record<string, unknown>, Input, Output>(
  cases: readonly QuerySpecZtdCase<RowShape, Input, Output>[],
  execute: QuerySpecExecutor<RowShape, Input, Output>
): Promise<QuerySpecExecutionEvidence[]> {
  const evidence: QuerySpecExecutionEvidence[] = [];
  for (const querySpecCase of cases) {
    evidence.push(await verifyQuerySpecZtdCase(querySpecCase, execute));
  }
  return evidence;
}

/**
 * Supported mode-switching runner for query-boundary cases.
 *
 * `ztd` uses fixture rewriting. `traditional` physically prepares DDL and
 * fixture rows before executing the same query boundary shape.
 */
export async function runQuerySpecCases<RowShape extends Record<string, unknown>, Input, Output>(
  cases: readonly (QuerySpecZtdCase<RowShape, Input, Output> | QuerySpecTraditionalCase<RowShape, Input, Output>)[],
  execute: QuerySpecExecutor<RowShape, Input, Output>,
  options: QuerySpecRunnerOptions = {}
): Promise<QuerySpecExecutionEvidence[]> {
  if ((options.mode ?? 'ztd') === 'traditional') {
    return runQuerySpecTraditionalCases(
      cases as readonly QuerySpecTraditionalCase<RowShape, Input, Output>[],
      execute
    );
  }

  return runQuerySpecZtdCases(cases as readonly QuerySpecZtdCase<RowShape, Input, Output>[], execute);
}

export async function runQuerySpecTraditionalCases<RowShape extends Record<string, unknown>, Input, Output>(
  cases: readonly QuerySpecTraditionalCase<RowShape, Input, Output>[],
  execute: QuerySpecExecutor<RowShape, Input, Output>
): Promise<QuerySpecExecutionEvidence[]> {
  const evidence: QuerySpecExecutionEvidence[] = [];
  for (const querySpecCase of cases) {
    evidence.push(await verifyQuerySpecTraditionalCase(querySpecCase, execute));
  }
  return evidence;
}

/**
 * Backward-compatible alias for older templates while the repo migrates to the queryspec-specific vocabulary.
 */
export const runZtdCases = runQuerySpecZtdCases;

export type { QuerySpecCase, QuerySpecTraditionalCase, QuerySpecZtdCase } from './case-types.js';
export type QuerySpecHarnessClient<RowShape extends Record<string, unknown>> = QuerySpecExecutorClient<RowShape>;
export type { QuerySpecExecutionEvidence } from './verifier.js';
