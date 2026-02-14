import { expect, test } from 'vitest';
import { CheckContractRuntimeError, resolveCheckContractExitCode } from '../src/commands/checkContract';

test('check contract exit code is 0 when checks pass', () => {
  const code = resolveCheckContractExitCode({
    result: { ok: true, violations: [], filesChecked: 1, specsChecked: 1 }
  });
  expect(code).toBe(0);
});

test('check contract exit code is 1 when violations exist', () => {
  const code = resolveCheckContractExitCode({
    result: {
      ok: false,
      filesChecked: 1,
      specsChecked: 1,
      violations: [
        {
          rule: 'unresolved-sql-file',
          severity: 'error',
          specId: 'bad',
          filePath: '/tmp/spec.json',
          message: 'missing'
        }
      ]
    }
  });
  expect(code).toBe(1);
});

test('check contract exit code is 2 for runtime/config errors', () => {
  const code = resolveCheckContractExitCode({ error: new CheckContractRuntimeError('bad config') });
  expect(code).toBe(2);
});
