import { expect, test } from 'vitest';

const {
  classifyPrReadiness,
  validatePrReadiness,
} = require('../../../scripts/check-pr-readiness.js') as {
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
  }): {
    ok: boolean;
    errors: string[];
  };
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
    'Upgrade note: use --scope-dir instead of --specs-dir in examples and shell snippets.',
    'Deprecation/removal plan or issue: remove the deprecated alias after issue #746 is closed.',
    'Docs/help/examples updated: query help text, README examples, and guide examples were updated together.',
    'Release/changeset wording: call out the rename, the deprecated alias, and the removal follow-up in one user-facing note.',
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
