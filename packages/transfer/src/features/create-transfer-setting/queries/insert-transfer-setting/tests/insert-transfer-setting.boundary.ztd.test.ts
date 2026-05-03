import { expect, test } from 'vitest';

import { runQuerySpecZtdCases } from '#tests/support/ztd/harness.js';
import { executeInsertTransferSettingQuerySpec } from '../boundary.js';
import cases from './cases/basic.case.js';
import type { InsertTransferSettingQueryBoundaryZtdCase } from './boundary-ztd-types.js';

test('create-transfer-setting/insert-transfer-setting boundary ZTD cases run', async () => {
  expect(cases.length).toBeGreaterThan(0);
  const evidence = await runQuerySpecZtdCases(cases, executeInsertTransferSettingQuerySpec);
  expect(evidence.every((entry) => entry.mode === 'ztd')).toBe(true);
  expect(evidence.every((entry) => entry.physicalSetupUsed === false)).toBe(true);
});
