import { expect, test } from 'vitest';

import { runQuerySpecZtdCases } from '#tests/support/ztd/harness.js';
import { executeResolveTransferDestinationDefinitionsQuerySpec } from '../boundary.js';
import cases from './cases/basic.case.js';
import type { ResolveTransferDestinationDefinitionsQueryBoundaryZtdCase } from './boundary-ztd-types.js';

test('create-transfer-setting/resolve-transfer-destination-definitions boundary ZTD cases run', async () => {
  expect(cases.length).toBeGreaterThan(0);
  const evidence = await runQuerySpecZtdCases(cases, executeResolveTransferDestinationDefinitionsQuerySpec);
  expect(evidence.every((entry) => entry.mode === 'ztd')).toBe(true);
  expect(evidence.every((entry) => entry.physicalSetupUsed === false)).toBe(true);
});
