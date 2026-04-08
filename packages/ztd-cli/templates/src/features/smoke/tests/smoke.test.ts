import { expect, test } from 'vitest';

import type { FeatureQueryExecutor } from '../../_shared/featureQueryExecutor.js';
import { executeSmokeEntrySpec } from '../boundary.js';

function createMockExecutor(rows: readonly Record<string, unknown>[]): FeatureQueryExecutor {
  return {
    async query<T = unknown>() {
      return [...rows] as T[];
    }
  };
}

test('rejects rows that do not satisfy the feature boundary response contract', async () => {
  await expect(
    executeSmokeEntrySpec(createMockExecutor([{ user_id: 1 }]), {
      user_id: 1
    })
  ).rejects.toThrow(/email|required|invalid/i);
});
