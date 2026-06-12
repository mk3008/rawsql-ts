import { expect, test } from 'vitest';

import { runQuerySpecZtdCases } from '#tests/support/ztd/harness.js';
import { executeInsertTransferDestinationDefinitionQuerySpec } from '../boundary.js';
import cases from './cases/basic.case.js';
import type { InsertTransferDestinationDefinitionQueryBoundaryZtdCase } from './boundary-ztd-types.js';

test('create-transfer-destination-definition/insert-transfer-destination-definition boundary ZTD cases run', async () => {
  expect(cases.length).toBeGreaterThan(0);
  const evidence = await runQuerySpecZtdCases(cases, executeInsertTransferDestinationDefinitionQuerySpec);
  expect(evidence.every((entry) => entry.mode === 'ztd')).toBe(true);
  expect(evidence.every((entry) => entry.physicalSetupUsed === false)).toBe(true);
});
