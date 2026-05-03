import { expect, test } from 'vitest';

import { runQuerySpecZtdCases } from '#tests/support/ztd/harness.js';
import { executeInsertTransferSettingDestinationDefinitionQuerySpec } from '../boundary.js';
import cases from './cases/basic.case.js';
import type { InsertTransferSettingDestinationDefinitionQueryBoundaryZtdCase } from './boundary-ztd-types.js';

test('create-transfer-setting/insert-transfer-setting-destination-definition boundary ZTD cases run', async () => {
  expect(cases.length).toBeGreaterThan(0);
  const evidence = await runQuerySpecZtdCases(cases, executeInsertTransferSettingDestinationDefinitionQuerySpec);
  expect(evidence.every((entry) => entry.mode === 'ztd')).toBe(true);
  expect(evidence.every((entry) => entry.physicalSetupUsed === false)).toBe(true);
});
