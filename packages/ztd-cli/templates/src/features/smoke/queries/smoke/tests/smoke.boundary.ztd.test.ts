import { expect, test } from 'vitest';

import { runQuerySpecZtdCases } from '#tests/support/ztd/harness.js';
import { executeSmokeQuerySpec } from '../boundary.js';
import cases from './cases/basic.case.js';

test('smoke/smoke boundary ZTD cases run through the fixed app-level harness', async () => {
  expect(cases.length).toBeGreaterThan(0);
  const evidence = await runQuerySpecZtdCases(cases, executeSmokeQuerySpec);
  expect(evidence.every((entry) => entry.mode === 'ztd')).toBe(true);
  expect(evidence.every((entry) => entry.physicalSetupUsed === false)).toBe(true);
});
