import { expect, test } from 'vitest';

import { runQuerySpecZtdCases } from '../../../../../../tests/support/ztd/harness.js';
import { executeSmokeQuerySpec } from '../spec.js';
import cases from './cases/basic.case.js';
import type { SmokeQuerySpecZtdCase } from './queryspec-ztd-types.js';

test('smoke/smoke spec ZTD cases run through the fixed app-level harness', async () => {
  expect(cases.length).toBeGreaterThan(0);
  await runQuerySpecZtdCases(cases, executeSmokeQuerySpec);
});
