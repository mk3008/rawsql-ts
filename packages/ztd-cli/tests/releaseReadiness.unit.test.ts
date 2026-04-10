import { expect, test } from 'vitest';

const {
  classifyReleaseReadiness,
  evaluateChangesetGuardrail,
} = require('../../../scripts/release-readiness.js') as {
  classifyReleaseReadiness(
    changedFiles: string[],
  ): {
    releaseAffecting: boolean;
    changedFiles: string[];
    matchedFiles: Array<{ filePath: string; kinds: string[] }>;
    matchedKinds: string[];
  };
  evaluateChangesetGuardrail(params: {
    releaseAffecting: boolean;
    changesetFiles: string[];
    labelNames: string[];
  }): {
    guardrailRequired: boolean;
    guardrailPassed: boolean;
    hasChangeset: boolean;
    hasNoReleaseLabel: boolean;
  };
};

test('release-readiness matches package surface, publish workflow, and release-note paths', () => {
  const classification = classifyReleaseReadiness([
    'packages/ztd-cli/src/commands/query.ts',
    '.github/workflows/publish.yml',
    '.changeset/release-readiness.md',
  ]);

  expect(classification.releaseAffecting).toBe(true);
  expect(classification.matchedKinds).toEqual([
    'package-surface',
    'publish-workflow',
    'release-notes',
  ]);
});

test('release-readiness treats package source and package READMEs as release-affecting', () => {
  const classification = classifyReleaseReadiness([
    'packages/core/src/transformers/SelectValueCollector.ts',
    'packages/ztd-cli/README.md',
  ]);

  expect(classification.releaseAffecting).toBe(true);
  expect(classification.matchedKinds).toEqual(['package-surface']);
  expect(classification.matchedFiles).toEqual([
    {
      filePath: 'packages/core/src/transformers/SelectValueCollector.ts',
      kinds: ['package-surface'],
    },
    {
      filePath: 'packages/ztd-cli/README.md',
      kinds: ['package-surface'],
    },
  ]);
});

test('release-readiness matches package manifest changes as publish-shape changes', () => {
  const classification = classifyReleaseReadiness([
    'packages/ztd-cli/package.json',
  ]);

  expect(classification.releaseAffecting).toBe(true);
  expect(classification.matchedFiles).toEqual([
    {
      filePath: 'packages/ztd-cli/package.json',
      kinds: ['package-surface'],
    },
  ]);
});

test('release-readiness matches nested package manifests as publish-shape changes', () => {
  const classification = classifyReleaseReadiness([
    'packages/adapters/adapter-node-pg/package.json',
    'packages/adapters/adapter-node-pg/CHANGELOG.md',
  ]);

  expect(classification.releaseAffecting).toBe(true);
  expect(classification.matchedKinds).toEqual(['package-surface']);
  expect(classification.matchedFiles).toEqual([
    {
      filePath: 'packages/adapters/adapter-node-pg/package.json',
      kinds: ['package-surface'],
    },
    {
      filePath: 'packages/adapters/adapter-node-pg/CHANGELOG.md',
      kinds: ['package-surface'],
    },
  ]);
});

test('release-readiness treats publish helper changes as release-affecting', () => {
  const classification = classifyReleaseReadiness([
    'scripts/build-publish-artifacts.mjs',
    'scripts/create-publish-proof-plan.mjs',
    'scripts/verify-published-package-mode.mjs',
  ]);

  expect(classification.releaseAffecting).toBe(true);
  expect(classification.matchedKinds).toEqual(['publish-workflow']);
});

test('release-readiness ignores ordinary package tests and docs outside the checklist', () => {
  const classification = classifyReleaseReadiness([
    'packages/ztd-cli/tests/queryLint.unit.test.ts',
    'docs/guide/overview.md',
  ]);

  expect(classification.releaseAffecting).toBe(false);
  expect(classification.matchedKinds).toEqual([]);
  expect(classification.matchedFiles).toEqual([]);
});

test('changeset guardrail fails release-affecting PRs without a changeset or no-release label', () => {
  expect(
    evaluateChangesetGuardrail({
      releaseAffecting: true,
      changesetFiles: [],
      labelNames: [],
    }),
  ).toEqual({
    guardrailRequired: true,
    guardrailPassed: false,
    hasChangeset: false,
    hasNoReleaseLabel: false,
  });
});

test('changeset guardrail passes when a release-affecting PR includes a changeset', () => {
  expect(
    evaluateChangesetGuardrail({
      releaseAffecting: true,
      changesetFiles: ['.changeset/example.md'],
      labelNames: [],
    }),
  ).toEqual({
    guardrailRequired: true,
    guardrailPassed: true,
    hasChangeset: true,
    hasNoReleaseLabel: false,
  });
});

test('changeset guardrail passes when a release-affecting PR carries the no-release label', () => {
  expect(
    evaluateChangesetGuardrail({
      releaseAffecting: true,
      changesetFiles: [],
      labelNames: ['no-release'],
    }),
  ).toEqual({
    guardrailRequired: true,
    guardrailPassed: true,
    hasChangeset: false,
    hasNoReleaseLabel: true,
  });
});
