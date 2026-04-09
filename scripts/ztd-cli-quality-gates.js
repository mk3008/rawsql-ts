const ESSENTIAL_TEST_FILES = [
  'tests/checkContract.cli-exit.test.ts',
  'tests/checkContract.cli.test.ts',
  'tests/checkContract.unit.test.ts',
  'tests/featureScaffold.unit.test.ts',
  'tests/featureTestsScaffold.unit.test.ts',
  'tests/gitignoreTemplate.pack.test.ts',
  'tests/init.command.test.ts',
  'tests/options.unit.test.ts',
  'tests/precommitEnforcement.unit.test.ts',
  'tests/qualityGates.unit.test.ts',
];

const SOFT_GATE_TEST_FILES = [
  'tests/repoGuidance.unit.test.ts',
  'tests/intentProcedure.docs.test.ts',
  'tests/perfBenchmark.unit.test.ts',
  'tests/perfSandbox.unit.test.ts',
  'tests/queryLint.unit.test.ts',
];

module.exports = {
  ESSENTIAL_TEST_FILES,
  SOFT_GATE_TEST_FILES,
};
