import type { PostgresTestkitClient } from '../support/postgres-testkit.js';

import type { ZtdCase } from './case-types.js';
import { verifyZtdCase } from './verifier.js';

type ZtdCaseExecutor<RowShape extends Record<string, unknown>, Input, Result> = (
  client: PostgresTestkitClient<RowShape>,
  input: Input
) => Promise<Result>;

/**
 * Fixed runner for app-level ZTD cases.
 *
 * Keep the app-level harness stable and let feature-local case files evolve.
 */
export async function runZtdCases<RowShape extends Record<string, unknown>, Input, Result>(
  cases: readonly ZtdCase<RowShape, Input, Result>[],
  execute: ZtdCaseExecutor<RowShape, Input, Result>
): Promise<void> {
  for (const ztdCase of cases) {
    await verifyZtdCase(ztdCase, execute);
  }
}
