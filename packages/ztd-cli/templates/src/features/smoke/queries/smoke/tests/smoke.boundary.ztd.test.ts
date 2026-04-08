import { expect, test } from 'vitest';

import { runQuerySpecZtdCases } from '../../../../../../tests/support/ztd/harness.js';
import { executeSmokeQuerySpec } from '../boundary.js';
import cases from './cases/basic.case.js';

test('smoke/smoke boundary ZTD cases run through the fixed app-level harness', async () => {
  expect(cases.length).toBeGreaterThan(0);
  await runQuerySpecZtdCases(cases, executeSmokeQuerySpec);
});
