import { expect, test } from 'vitest';

import type { FeatureQueryExecutor } from '../../_shared/featureQueryExecutor.js';
import { executeSmokeEntrySpec } from '../boundary.js';

function createGuardedExecutor(): FeatureQueryExecutor {
  return {
    async query() {
      throw new Error('Feature boundary tests stay mock-based for smoke; keep DB-backed execution in the query lane.');
    }
  };
}

function createMockExecutor(rows: readonly Record<string, unknown>[]): FeatureQueryExecutor {
  return {
    async query<T = unknown>() {
      return [...rows] as T[];
    }
  };
}

test('maps the starter smoke request through the feature boundary', async () => {
  await expect(
    executeSmokeEntrySpec(createMockExecutor([{ user_id: 1, email: 'alice@example.com' }]), {
      user_id: 1
    })
  ).resolves.toEqual({ user_id: 1, email: 'alice@example.com' });
});

test('rejects invalid feature input at the feature boundary for smoke', async () => {
  await expect(executeSmokeEntrySpec(createGuardedExecutor(), {})).rejects.toThrow(
    /user_id|required|invalid/i
  );
});
