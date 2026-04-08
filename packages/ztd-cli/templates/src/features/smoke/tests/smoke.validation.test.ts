import { expect, test } from 'vitest';

import type { FeatureQueryExecutor } from '../../_shared/featureQueryExecutor.js';
import { executeSmokeEntrySpec } from '../boundary.js';

function createGuardedExecutor(): FeatureQueryExecutor {
  return {
    async query() {
      throw new Error('Validation should reject before the query lane runs.');
    }
  };
}

test('rejects zero user_id values at the feature boundary', async () => {
  await expect(executeSmokeEntrySpec(createGuardedExecutor(), { user_id: 0 })).rejects.toThrow(
    /user_id|positive|invalid/i
  );
});

test('rejects non-object requests at the feature boundary', async () => {
  await expect(executeSmokeEntrySpec(createGuardedExecutor(), null)).rejects.toThrow(
    /object|user_id|invalid/i
  );
});
