import { expect, test } from 'vitest';

const {
  collectPolicyViolations,
  isPerfEvidenceFile,
  isPerfSensitiveSourceFile,
  isLocalTaskLedgerFile,
  isQuerySpecFile,
  isRepositorySourceFile,
  isTestFile,
} = require('../../../scripts/precommit-enforcement.js') as {
  collectPolicyViolations(
    stagedFiles: string[],
    options?: { readFile?: (filePath: string) => string },
  ): string[];
  isPerfEvidenceFile(filePath: string): boolean;
  isPerfSensitiveSourceFile(filePath: string): boolean;
  isLocalTaskLedgerFile(filePath: string): boolean;
  isQuerySpecFile(filePath: string): boolean;
  isRepositorySourceFile(filePath: string): boolean;
  isTestFile(filePath: string): boolean;
};

test('query spec changes require a staged test file', () => {
  const violations = collectPolicyViolations([
    'packages/ztd-cli/src/catalog/specs/orderSummary.spec.ts',
  ]);

  expect(violations).toEqual([
    expect.stringContaining('QuerySpec changes require tests in the same commit.'),
  ]);
});

test('repository changes require telemetry hook markers', () => {
  const violations = collectPolicyViolations(
    ['packages/demo/src/repositories/views/ordersRepository.ts'],
    {
      readFile: () => 'export class OrdersRepository {}',
    },
  );

  expect(violations).toEqual([
    expect.stringContaining('Repository source changes must include a telemetry hook seam.'),
  ]);
});

test('perf-sensitive changes require staged perf evidence', () => {
  const violations = collectPolicyViolations([
    'packages/ztd-cli/src/perf/benchmark.ts',
  ]);

  expect(violations).toEqual([
    expect.stringContaining('Perf-sensitive changes require perf evidence in the same commit.'),
  ]);
});

test('paired tests, telemetry markers, and perf evidence satisfy the policy', () => {
  const violations = collectPolicyViolations(
    [
      'packages/demo/src/catalog/specs/orderSummary.spec.ts',
      'packages/demo/tests/orderSummary.test.ts',
      'packages/demo/src/repositories/views/ordersRepository.ts',
      'benchmarks/parser-phase-benchmark.ts',
      'docs/dogfooding/telemetry-dogfooding.md',
    ],
    {
      readFile: () =>
        "import { resolveRepositoryTelemetry, type RepositoryTelemetry } from '../telemetry/repositoryTelemetry';",
    },
  );

  expect(violations).toEqual([]);
});

test('tmp task ledgers are rejected even when staged explicitly', () => {
  const violations = collectPolicyViolations([
    'tmp/PLAN.md',
  ]);

  expect(violations).toEqual([
    expect.stringContaining('Local task ledgers under tmp/ must not be committed.'),
  ]);
});

test('path classifiers stay aligned with the enforced policy', () => {
  expect(isTestFile('packages/ztd-cli/tests/init.command.test.ts')).toBe(true);
  expect(isQuerySpecFile('packages/demo/src/catalog/specs/orderSummary.spec.ts')).toBe(true);
  expect(isRepositorySourceFile('packages/demo/src/repositories/views/ordersRepository.ts')).toBe(true);
  expect(isPerfSensitiveSourceFile('benchmarks/parser-phase-benchmark.ts')).toBe(true);
  expect(isPerfEvidenceFile('docs/dogfooding/telemetry-dogfooding.md')).toBe(true);
  expect(isLocalTaskLedgerFile('tmp/PLAN.md')).toBe(true);
  expect(isLocalTaskLedgerFile('tmp/sub/PLAN.md')).toBe(true);
  expect(isLocalTaskLedgerFile('prefix/tmp/PLAN.md')).toBe(true);
  expect(isLocalTaskLedgerFile('prefix/tmp/sub/PLAN.md')).toBe(true);
  expect(isLocalTaskLedgerFile('not_tmp/PLAN.md')).toBe(false);
});
