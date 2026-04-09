import { expect, test } from 'vitest';

const {
  ESSENTIAL_TEST_FILES,
  SOFT_GATE_TEST_FILES,
} = require('../../../scripts/ztd-cli-quality-gates.js') as {
  ESSENTIAL_TEST_FILES: string[];
  SOFT_GATE_TEST_FILES: string[];
};

test('essential suite stays focused on scaffold and CLI contract coverage', () => {
  expect(ESSENTIAL_TEST_FILES).toEqual(
    expect.arrayContaining([
      'tests/checkContract.cli.test.ts',
      'tests/featureScaffold.unit.test.ts',
      'tests/init.command.test.ts',
      'tests/precommitEnforcement.unit.test.ts',
    ]),
  );
  expect(ESSENTIAL_TEST_FILES).not.toEqual(
    expect.arrayContaining([
      'tests/repoGuidance.unit.test.ts',
      'tests/intentProcedure.docs.test.ts',
      'tests/perfBenchmark.unit.test.ts',
      'tests/perfSandbox.unit.test.ts',
      'tests/queryLint.unit.test.ts',
    ]),
  );
});

test('soft-gate suite keeps docs, perf, and query lint coverage visible', () => {
  expect(SOFT_GATE_TEST_FILES).toEqual(expect.arrayContaining([
    'tests/repoGuidance.unit.test.ts',
    'tests/intentProcedure.docs.test.ts',
    'tests/perfBenchmark.unit.test.ts',
    'tests/perfSandbox.unit.test.ts',
    'tests/queryLint.unit.test.ts',
  ]));
});
