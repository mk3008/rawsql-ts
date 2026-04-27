import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';

const {
  classifyPullRequestContext,
  classifyPrReadiness,
  validatePrReadiness,
} = require('../../../scripts/check-pr-readiness.js') as {
  classifyPullRequestContext(eventPath: string): {
    isReleasePr: boolean;
    headRef: string;
    title: string;
    authorLogin: string;
  };
  classifyPrReadiness(changedFiles: string[]): {
    changedFiles: string[];
    requiresCliMigrationPacket: boolean;
    requiresScaffoldContractProof: boolean;
    cliMatchedFiles: string[];
    scaffoldMatchedFiles: string[];
  };
  validatePrReadiness(input: {
    body: string;
    classification: {
      changedFiles: string[];
      requiresCliMigrationPacket: boolean;
      requiresScaffoldContractProof: boolean;
      cliMatchedFiles: string[];
      scaffoldMatchedFiles: string[];
    };
    pullRequestContext?: {
      isReleasePr: boolean;
      headRef: string;
      title: string;
      authorLogin: string;
    };
  }): {
    ok: boolean;
    errors: string[];
  };
};
const {
  buildPreparedPrReadiness,
  parseArgs,
} = require('../../../scripts/prepare-pr-readiness.js') as {
  buildPreparedPrReadiness(input: {
    baseSha?: string | null;
    headSha?: string | null;
    changedFiles: string[];
    summaryLines?: string[];
    verificationLines?: string[];
    baselineMode?: 'no-exception' | 'exception';
    trackingIssue?: string;
    scopedChecks?: string[];
    baselineRationale?: string;
    cliMode?: 'no-packet' | 'packet' | null;
    cliNoMigrationRationale?: string;
    upgradeNote?: string;
    deprecationPlan?: string;
    docsUpdated?: string;
    releaseWording?: string;
    scaffoldMode?: 'no-proof' | 'proof' | null;
    noProofRationale?: string;
    nonEditAssertion?: string;
    failFastProof?: string;
    generatedOutputProof?: string;
  }): {
    classification: {
      changedFiles: string[];
      requiresCliMigrationPacket: boolean;
      requiresScaffoldContractProof: boolean;
      cliMatchedFiles: string[];
      scaffoldMatchedFiles: string[];
    };
    body: string;
  };
  parseArgs(argv: string[]): Record<string, unknown>;
};

function createBaseBody(): string {
  return [
    '## Summary',
    '',
    '- add process guardrails',
    '',
    '## Verification',
    '',
    '- pnpm --filter @rawsql-ts/ztd-cli test:essential',
    '',
    '## Merge Readiness',
    '',
    '- [x] No baseline exception requested.',
    '- [ ] Baseline exception requested and linked below.',
    '',
    'Tracking issue:',
    'Scoped checks run:',
    'Why full baseline is not required:',
    '',
    '## CLI Surface Migration',
    '',
    '- [ ] No migration packet required for this CLI change.',
    '- [ ] CLI/user-facing surface change and migration packet completed.',
    '',
    'No-migration rationale:',
    'Upgrade note:',
    'Deprecation/removal plan or issue:',
    'Docs/help/examples updated:',
    'Release/changeset wording:',
    '',
    '## Scaffold Contract Proof',
    '',
    '- [ ] No scaffold contract proof required for this PR.',
    '- [ ] Scaffold contract proof completed.',
    '',
    'No-proof rationale:',
    'Non-edit assertion:',
    'Fail-fast input-contract proof:',
    'Generated-output viability proof:',
    '',
  ].join('\n');
}

test('pr-readiness classifies CLI and scaffold changes independently', () => {
  const classification = classifyPrReadiness([
    'packages/ztd-cli/src/commands/query.ts',
    'packages/ztd-cli/templates/src/features/smoke/boundary.ts',
    'README.md',
  ]);

  expect(classification.requiresCliMigrationPacket).toBe(true);
  expect(classification.requiresScaffoldContractProof).toBe(true);
  expect(classification.cliMatchedFiles).toEqual(['packages/ztd-cli/src/commands/query.ts']);
  expect(classification.scaffoldMatchedFiles).toEqual(['packages/ztd-cli/templates/src/features/smoke/boundary.ts']);
});

test('pr-readiness accepts a tracked baseline exception plus CLI migration packet', () => {
  const body = [
    '## Summary',
    '',
    '- rename a public query uses flag',
    '',
    '## Verification',
    '',
    '- pnpm --filter @rawsql-ts/ztd-cli test:essential',
    '',
    '## Merge Readiness',
    '',
    '- [ ] No baseline exception requested.',
    '- [x] Baseline exception requested and linked below.',
    '',
    'Tracking issue: #735',
    'Scoped checks run: pnpm --filter @rawsql-ts/ztd-cli test:essential, pnpm verify:generated-project-mode',
    'Why full baseline is not required: the unrelated baseline failure is tracked separately and this PR only needs the scoped lanes above.',
    '',
    '## CLI Surface Migration',
    '',
    '- [ ] No migration packet required for this CLI change.',
    '- [x] CLI/user-facing surface change and migration packet completed.',
    '',
    'No-migration rationale:',
    'Upgrade note: `ztd query uses` no longer accepts `--specs-dir`; use `--scope-dir` in examples and shell snippets.',
    'Deprecation/removal plan or issue: issue #746 removed the deprecated alias from `query uses`.',
    'Docs/help/examples updated: query help text, tutorial examples, and guide examples were updated together.',
    'Release/changeset wording: call out the alias removal and the required `--scope-dir` replacement in one user-facing note.',
    '',
    '## Scaffold Contract Proof',
    '',
    '- [x] No scaffold contract proof required for this PR.',
    '- [ ] Scaffold contract proof completed.',
    '',
    'No-proof rationale: this change only touches the query uses CLI surface.',
    'Non-edit assertion:',
    'Fail-fast input-contract proof:',
    'Generated-output viability proof:',
    '',
  ].join('\n');

  const validation = validatePrReadiness({
    body,
    classification: classifyPrReadiness(['packages/ztd-cli/src/commands/query.ts']),
  });

  expect(validation.ok).toBe(true);
  expect(validation.errors).toEqual([]);
});

test('pr-readiness rejects CLI changes without a migration packet or rationale', () => {
  const validation = validatePrReadiness({
    body: createBaseBody(),
    classification: classifyPrReadiness(['packages/ztd-cli/src/commands/query.ts']),
  });

  expect(validation.ok).toBe(false);
  expect(validation.errors).toEqual(expect.arrayContaining([
    'Select exactly one CLI Surface Migration checkbox.',
  ]));
});

test('pr-readiness rejects scaffold changes without the three proof classes', () => {
  const body = [
    '## Summary',
    '',
    '- harden scaffold tests',
    '',
    '## Verification',
    '',
    '- pnpm --filter @rawsql-ts/ztd-cli test:essential',
    '',
    '## Merge Readiness',
    '',
    '- [x] No baseline exception requested.',
    '- [ ] Baseline exception requested and linked below.',
    '',
    'Tracking issue:',
    'Scoped checks run:',
    'Why full baseline is not required:',
    '',
    '## CLI Surface Migration',
    '',
    '- [x] No migration packet required for this CLI change.',
    '- [ ] CLI/user-facing surface change and migration packet completed.',
    '',
    'No-migration rationale: this PR only changes scaffold guardrails.',
    'Upgrade note:',
    'Deprecation/removal plan or issue:',
    'Docs/help/examples updated:',
    'Release/changeset wording:',
    '',
    '## Scaffold Contract Proof',
    '',
    '- [ ] No scaffold contract proof required for this PR.',
    '- [x] Scaffold contract proof completed.',
    '',
    'No-proof rationale:',
    'Non-edit assertion: parent boundary.ts remains untouched while child query boundaries are added.',
    'Fail-fast input-contract proof:',
    'Generated-output viability proof: generated output still includes the required shared imports.',
    '',
  ].join('\n');

  const validation = validatePrReadiness({
    body,
    classification: classifyPrReadiness(['packages/ztd-cli/templates/src/features/smoke/boundary.ts']),
  });

  expect(validation.ok).toBe(false);
  expect(validation.errors.some((error) => error.includes('Scaffold contract proof must include a fail-fast input-contract proof.'))).toBe(true);
});

test('pr-readiness skips the human-authored body contract for release PRs', () => {
  const validation = validatePrReadiness({
    body: 'This PR was opened by the Changesets release GitHub action.',
    classification: classifyPrReadiness([
      'packages/ztd-cli/package.json',
      'packages/core/CHANGELOG.md',
    ]),
    pullRequestContext: {
      isReleasePr: true,
      headRef: 'changeset-release/main',
      title: 'chore(release): version packages',
      authorLogin: 'github-actions[bot]',
    },
  });

  expect(validation.ok).toBe(true);
  expect(validation.errors).toEqual([]);
});

test('pr-readiness classifies a changeset release branch as a release PR', () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'pr-readiness-event-'));
  const eventPath = path.join(rootDir, 'event.json');
  writeFileSync(eventPath, JSON.stringify({
    pull_request: {
      head: { ref: 'changeset-release/main' },
      title: 'chore(release): version packages',
      user: { login: 'github-actions[bot]' },
    },
  }), 'utf8');

  expect(classifyPullRequestContext(eventPath)).toEqual({
    isReleasePr: true,
    headRef: 'changeset-release/main',
    title: 'chore(release): version packages',
    authorLogin: 'github-actions[bot]',
  });
});

test('pr-readiness preparation renders a validator-compatible CLI packet body', () => {
  const prepared = buildPreparedPrReadiness({
    changedFiles: ['packages/ztd-cli/src/commands/query.ts'],
    summaryLines: ['align query flag migration guidance'],
    verificationLines: ['pnpm --filter @rawsql-ts/ztd-cli test -- prReadiness.unit.test.ts'],
    baselineMode: 'no-exception',
    cliMode: 'packet',
    upgradeNote: 'Replace `--specs-dir` with `--scope-dir` in command examples.',
    deprecationPlan: 'Issue #746 tracks the deprecated alias removal.',
    docsUpdated: 'CLI help output and guide examples were updated together.',
    releaseWording: 'Call out the required flag rename in the release note.',
  });

  expect(prepared.body).toContain('Tracking issue: not needed; no baseline exception requested.');
  expect(prepared.body).toContain('Upgrade note: Replace `--specs-dir` with `--scope-dir` in command examples.');

  const validation = validatePrReadiness({
    body: prepared.body,
    classification: prepared.classification,
  });

  expect(validation.ok).toBe(true);
  expect(validation.errors).toEqual([]);
});

test('pr-readiness preparation renders scaffold proof fields on the same line as labels', () => {
  const prepared = buildPreparedPrReadiness({
    changedFiles: ['packages/ztd-cli/templates/src/features/smoke/boundary.ts'],
    summaryLines: ['mechanize scaffold proof authoring'],
    verificationLines: ['pnpm --filter @rawsql-ts/ztd-cli test -- prReadiness.unit.test.ts'],
    baselineMode: 'no-exception',
    scaffoldMode: 'proof',
    nonEditAssertion: 'The parent feature boundary remains untouched while the generated child import shape is asserted separately.',
    failFastProof: 'The prepared body requires the explicit proof field before validation succeeds.',
    generatedOutputProof: 'Generated project verification confirms the scaffolded output stays viable.',
  });

  expect(prepared.body).toContain('Non-edit assertion: The parent feature boundary remains untouched while the generated child import shape is asserted separately.');
  expect(prepared.body).toContain('Fail-fast input-contract proof: The prepared body requires the explicit proof field before validation succeeds.');
  expect(prepared.body).not.toContain('Non-edit assertion:\n');

  const validation = validatePrReadiness({
    body: prepared.body,
    classification: prepared.classification,
  });

  expect(validation.ok).toBe(true);
  expect(validation.errors).toEqual([]);
});

test('pr-readiness preparation fails fast when classified CLI changes omit a mode selection', () => {
  expect(() => buildPreparedPrReadiness({
    changedFiles: ['packages/ztd-cli/src/commands/query.ts'],
    summaryLines: ['omit CLI mode to prove fail-fast guidance'],
    verificationLines: ['pnpm --filter @rawsql-ts/ztd-cli test -- prReadiness.unit.test.ts'],
    baselineMode: 'no-exception',
  })).toThrow('CLI-facing changes require --cli-mode set to "no-packet" or "packet".');
});

test('pr-readiness preparation fails fast when classified scaffold changes omit a mode selection', () => {
  expect(() => buildPreparedPrReadiness({
    changedFiles: ['packages/ztd-cli/templates/src/features/smoke/boundary.ts'],
    summaryLines: ['omit scaffold mode to prove fail-fast guidance'],
    verificationLines: ['pnpm --filter @rawsql-ts/ztd-cli test -- prReadiness.unit.test.ts'],
    baselineMode: 'no-exception',
  })).toThrow(/--scaffold-mode/);
});

test('pr-readiness parseArgs fails fast when --changed-file has no operand', () => {
  expect(() => parseArgs(['--changed-file', '--summary-line', 'body']))
    .toThrow('--changed-file requires a non-empty value.');
});

test('pr-readiness parseArgs fails fast when --summary-line has a blank operand', () => {
  expect(() => parseArgs(['--summary-line', '   ']))
    .toThrow('--summary-line requires a non-empty value.');
});
