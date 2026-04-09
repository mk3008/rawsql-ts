import { expect, test } from 'vitest';

const {
  classifyReleaseReadiness,
} = require('../../../scripts/release-readiness.js') as {
  classifyReleaseReadiness(
    changedFiles: string[],
  ): {
    releaseAffecting: boolean;
    changedFiles: string[];
    matchedFiles: Array<{ filePath: string; kinds: string[] }>;
    matchedKinds: string[];
  };
};

test('release-readiness matches scaffold, publish workflow, and release-note paths', () => {
  const classification = classifyReleaseReadiness([
    'packages/ztd-cli/templates/src/catalog/runtime/index.ts',
    '.github/workflows/publish.yml',
    '.changeset/release-readiness.md',
  ]);

  expect(classification.releaseAffecting).toBe(true);
  expect(classification.matchedKinds).toEqual([
    'publish-workflow',
    'release-notes',
    'scaffold-layout',
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
      kinds: ['scaffold-layout', 'package-publish-shape'],
    },
  ]);
});

test('release-readiness matches nested package manifests as publish-shape changes', () => {
  const classification = classifyReleaseReadiness([
    'packages/adapters/adapter-node-pg/package.json',
    'packages/adapters/adapter-node-pg/CHANGELOG.md',
  ]);

  expect(classification.releaseAffecting).toBe(true);
  expect(classification.matchedKinds).toEqual(['package-publish-shape']);
  expect(classification.matchedFiles).toEqual([
    {
      filePath: 'packages/adapters/adapter-node-pg/package.json',
      kinds: ['package-publish-shape'],
    },
    {
      filePath: 'packages/adapters/adapter-node-pg/CHANGELOG.md',
      kinds: ['package-publish-shape'],
    },
  ]);
});

test('release-readiness ignores ordinary package tests and docs outside the checklist', () => {
  const classification = classifyReleaseReadiness([
    'packages/ztd-cli/tests/queryLint.unit.test.ts',
    'docs/guide/ztd-cli-quality-gates.md',
  ]);

  expect(classification.releaseAffecting).toBe(false);
  expect(classification.matchedKinds).toEqual([]);
  expect(classification.matchedFiles).toEqual([]);
});
