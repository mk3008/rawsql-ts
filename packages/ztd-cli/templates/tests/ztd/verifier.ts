import { expect } from 'vitest';

import { createStarterPostgresTestkitClient, type PostgresTestkitClient } from '../support/postgres-testkit.js';

import type { ZtdCase } from './case-types.js';

type ZtdCaseExecutor<RowShape extends Record<string, unknown>, Input, Result> = (
  client: PostgresTestkitClient<RowShape>,
  input: Input
) => Promise<Result>;

export async function verifyZtdCase<RowShape extends Record<string, unknown>, Input, Result>(
  ztdCase: ZtdCase<RowShape, Input, Result>,
  execute: ZtdCaseExecutor<RowShape, Input, Result>
): Promise<void> {
  const client = createStarterPostgresTestkitClient<RowShape>(ztdCase.clientOptions ?? {});

  try {
    const result = await execute(client, ztdCase.input);
    if (ztdCase.assertResult) {
      await ztdCase.assertResult(result);
      return;
    }

    if ('expectedResult' in ztdCase) {
      expect(result).toEqual(ztdCase.expectedResult);
    }

    if (ztdCase.assertAfter) {
      await ztdCase.assertAfter(client);
    }
  } finally {
    await client.close();
  }
}
