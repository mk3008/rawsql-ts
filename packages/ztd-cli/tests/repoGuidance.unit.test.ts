import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');

function readText(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

test('repo-local Codex guidance files exist and point at developer workflows', () => {
  expect(existsSync(resolve(repoRoot, '.codex', 'config.toml'))).toBe(true);
  expect(existsSync(resolve(repoRoot, '.codex', 'agents', 'planning.md'))).toBe(true);
  expect(existsSync(resolve(repoRoot, '.codex', 'agents', 'verification.md'))).toBe(true);
  expect(existsSync(resolve(repoRoot, '.codex', 'agents', 'review.md'))).toBe(true);
  expect(existsSync(resolve(repoRoot, '.codex', 'agents', 'reporting.md'))).toBe(true);
  expect(existsSync(resolve(repoRoot, '.agents', 'skills', 'acceptance-planning', 'SKILL.md'))).toBe(true);
  expect(existsSync(resolve(repoRoot, '.agents', 'skills', 'self-review', 'SKILL.md'))).toBe(true);
  expect(existsSync(resolve(repoRoot, '.agents', 'skills', 'attainment-reporting', 'SKILL.md'))).toBe(true);
});

test('planning guidance covers acceptance items and verification methods', () => {
  const planningSkill = readText('.agents/skills/acceptance-planning/SKILL.md');
  const planningAgent = readText('.codex/agents/planning.md');
  const verificationAgent = readText('.codex/agents/verification.md');

  expect(planningSkill).toContain('Source issue');
  expect(planningSkill).toContain('Why it matters');
  expect(planningSkill).toContain('Acceptance items');
  expect(planningSkill).toContain('Decision points');
  expect(planningSkill).toContain('Verification methods');
  expect(planningAgent).toContain('State the source issue or request and why it matters.');
  expect(planningAgent).toContain('Source issue');
  expect(planningAgent).toContain('Why it matters');
  expect(planningAgent).toContain('Decision points, when relevant');
  expect(planningAgent).toContain('Define explicit acceptance items.');
  expect(planningAgent).toContain('Attach a concrete verification method to each acceptance item.');
  expect(verificationAgent).toContain('State verification basis when the evidence needs interpretation.');
  expect(verificationAgent).toContain('Confirm whether the planned verification methods were actually satisfied; do not silently replace them.');
});

test('reporting guidance covers reviewer-facing and operator-facing reporting shape', () => {
  const reportingSkill = readText('.agents/skills/attainment-reporting/SKILL.md');
  const reviewSkill = readText('.agents/skills/self-review/SKILL.md');
  const reportingAgent = readText('.codex/agents/reporting.md');
  const reviewAgent = readText('.codex/agents/review.md');
  const rootAgents = readText('AGENTS.md');
  const mirrorAgents = readText('.agent/AGENTS.md');

  expect(reportingSkill).toContain('Source request or source issue');
  expect(reportingSkill).toContain('Why it matters');
  expect(reportingSkill).toContain('What changed');
  expect(reportingSkill).toContain('Decision points');
  expect(reportingSkill).toContain('Verification basis');
  expect(reportingSkill).toContain('Guarantee limits');
  expect(reportingSkill).toContain('Outstanding gaps');
  expect(reportingSkill).toContain('What the human should decide next');
  expect(reportingSkill).toContain('describe the meaning of the change before naming files');
  expect(reportingSkill).toContain('what observation was treated as sufficient');
  expect(reportingSkill).toContain('prefer a narrow accept-or-defer style choice');
  expect(reportingSkill).toContain('The final report form MUST include every acceptance item as `acceptance item`, `status`, `evidence`, and `gap`.');
  expect(reportingSkill).toContain('The final PR text and normal work report MUST show those per-item fields directly');
  expect(reportingSkill).toContain('do not use local filesystem links such as `/C:/...`');
  expect(reportingSkill).toContain('treat the final form as incomplete');
  expect(reportingSkill).toContain('Distinguish `tests were updated` from `tests passed`.');
  expect(reportingSkill).toContain('keep the affected item `partial` or `not done`');
  expect(reportingSkill).toContain('pass consistency review and human acceptance review');
  expect(reportingSkill).toContain('Review findings MUST be triaged as `blocker`, `follow-up`, or `nit`.');
  expect(reportingSkill).toContain('`Repository evidence` MUST be the primary evidence class for acceptance judgment.');
  expect(reportingSkill).toContain('`Supplementary evidence` means local logs, external observations');
  expect(reportingSkill).toContain('`Supplementary evidence` alone MUST NOT justify a strong `done` claim');
  expect(reportingSkill).toContain('Mapping each acceptance item to `done`, `partial`, or `not done`.');
  expect(reportingAgent).toContain('The report is a decision document, not a work log.');
  expect(reportingAgent).toContain('Source issue or request');
  expect(reportingAgent).toContain('Why it matters');
  expect(reportingAgent).toContain('What changed');
  expect(reportingAgent).not.toContain('Decision points');
  expect(reportingAgent).toContain('Verification basis');
  expect(reportingAgent).toContain('Guarantee limits');
  expect(reportingAgent).toContain('Outstanding gaps');
  expect(reportingAgent).toContain('What the human should decide next');
  expect(reportingAgent).toContain('explain the meaning of the change before listing touched files');
  expect(reportingAgent).toContain('What the human should decide next`, phrased as a narrow choice whenever possible.');
  expect(reportingAgent).not.toContain('what observation was treated as enough');
  expect(reportingAgent).toContain('phrased as a narrow choice whenever possible.');
  expect(reportingAgent).not.toContain('The final PR text must leave those fields visible per item');
  expect(reportingAgent).not.toContain('The same per-item final form is required for normal Codex work reports');
  expect(reportingAgent).not.toContain('do not emit local filesystem links such as `/C:/...`');
  expect(reportingAgent).not.toContain('the final form is incomplete and must be corrected');
  expect(reportingAgent).toContain('Keep `tests were updated`, `tests passed`, and `execution remains partial` separate');
  expect(reportingAgent).not.toContain('pass consistency review and human acceptance review');
  expect(reportingAgent).not.toContain('Review findings must be triaged as `blocker`, `follow-up`, or `nit`.');
  expect(reportingAgent).toContain('`Repository evidence` is the primary basis for acceptance judgment in PR-facing text.');
  expect(reportingAgent).toContain('`Supplementary evidence` must be labeled as supplementary and must not be presented as equivalent to repository evidence.');
  expect(reportingAgent).toContain('keep it `partial` or narrow the claim with explicit guarantee limits');
  expect(reportingAgent).not.toContain('Map each plan-time acceptance item to `done`, `partial`, or `not done`.');
  expect(reviewSkill).toContain('consistency review');
  expect(reviewSkill).toContain('human acceptance review');
  expect(reviewSkill).toContain('`blocker`, `follow-up`, or `nit`');
  expect(reviewSkill).toContain('Run both review cycles before claiming readiness for human review.');
  expect(reviewAgent).toContain('Review Cycle 1: Consistency Review');
  expect(reviewAgent).toContain('Review Cycle 2: Human Acceptance Review');
  expect(reviewAgent).toContain('Triage Rules');
  expect(reviewAgent).toContain('Unsupported `done` claims based mainly on supplementary evidence are blockers.');
  expect(reviewAgent).toContain('If a blocker remains, the result is not ready for human review.');
  expect(rootAgents).toContain('Keep assistant-user conversation in Japanese in this repository.');
  expect(rootAgents).toContain('Final user-facing progress and completion reports should use explicit sections rather than long narrative-only blocks when multiple concerns are being reported.');
  expect(rootAgents).toContain('Final PR text and final implementation reports must pass self-review before human review.');
  expect(rootAgents).not.toContain('Review findings MUST be triaged as `blocker`, `follow-up`, or `nit`.');
  expect(rootAgents).not.toContain('Reports MUST distinguish `Repository evidence` from `Supplementary evidence` when both appear.');
  expect(rootAgents).not.toContain('PR reports MUST treat `Repository evidence` as the primary basis for acceptance judgment.');
  expect(rootAgents).toContain('Supplementary evidence alone must not justify a strong `done` claim.');
  expect(mirrorAgents).toContain('All assistant-user conversation in this repository must be in Japanese.');
  expect(mirrorAgents).toContain('Reports MUST use an itemized structure with `acceptance item`, `status`, `evidence`, and `gap`.');
  expect(mirrorAgents).toContain('Final PR text and final implementation reports MUST pass two-cycle self-review before human review.');
  expect(mirrorAgents).toContain('Review findings MUST be triaged as `blocker`, `follow-up`, or `nit`.');
  expect(mirrorAgents).toContain('Reports MUST distinguish `Repository evidence` from `Supplementary evidence` when both appear.');
  expect(mirrorAgents).toContain('PR reports MUST treat `Repository evidence` as the primary basis for acceptance judgment.');
  expect(mirrorAgents).toContain('`Supplementary evidence` alone MUST NOT justify a strong `done` claim');
});

test('reporting guidance fixes the decision-oriented order', () => {
  const reportingSkill = readText('.agents/skills/attainment-reporting/SKILL.md');
  const sourceIndex = reportingSkill.indexOf('Source request or source issue');
  const whyIndex = reportingSkill.indexOf('Why it matters');
  const changedIndex = reportingSkill.indexOf('What changed');
  const verificationIndex = reportingSkill.indexOf('Verification basis');
  const limitsIndex = reportingSkill.indexOf('Guarantee limits');
  const gapsIndex = reportingSkill.indexOf('Outstanding gaps');
  const nextDecisionIndex = reportingSkill.indexOf('What the human should decide next');

  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  expect(whyIndex).toBeGreaterThan(sourceIndex);
  expect(changedIndex).toBeGreaterThan(whyIndex);
  expect(verificationIndex).toBeGreaterThan(changedIndex);
  expect(limitsIndex).toBeGreaterThan(verificationIndex);
  expect(gapsIndex).toBeGreaterThan(limitsIndex);
  expect(nextDecisionIndex).toBeGreaterThan(gapsIndex);
});

test('.codex/config.toml routes developer workflows to repo-local guidance', () => {
  const config = readText('.codex/config.toml');

  expect(config).toContain('developer_only = true');
  expect(config).toContain('preferred_workflows = ["planning", "verification", "review", "reporting"]');
  expect(config).not.toContain('required_reporting_fields = ["acceptance_items", "verification_methods", "repository_evidence", "supplementary_evidence", "review_triage", "attainment_status"]');
  expect(config).toContain('planning = ".codex/agents/planning.md"');
  expect(config).toContain('verification = ".codex/agents/verification.md"');
  expect(config).toContain('review = ".codex/agents/review.md"');
  expect(config).toContain('reporting = ".codex/agents/reporting.md"');
});
