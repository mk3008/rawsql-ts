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
  expect(existsSync(resolve(repoRoot, '.codex', 'agents', 'reporting.md'))).toBe(true);
  expect(existsSync(resolve(repoRoot, '.agents', 'skills', 'acceptance-planning', 'SKILL.md'))).toBe(true);
  expect(existsSync(resolve(repoRoot, '.agents', 'skills', 'attainment-reporting', 'SKILL.md'))).toBe(true);
});

test('planning guidance covers acceptance items and verification methods', () => {
  const planningSkill = readText('.agents/skills/acceptance-planning/SKILL.md');
  const planningAgent = readText('.codex/agents/planning.md');
  const verificationAgent = readText('.codex/agents/verification.md');

  expect(planningSkill).toContain('Source issue');
  expect(planningSkill).toContain('Why it matters');
  expect(planningSkill).toContain('Acceptance items');
  expect(planningSkill).toContain('Verification methods');
  expect(planningAgent).toContain('Identify the source issue and explain why it matters.');
  expect(planningAgent).toContain('Source issue');
  expect(planningAgent).toContain('Why it matters');
  expect(planningAgent).toContain('Write acceptance items that are specific, testable, and narrow enough for per-item completion judgment.');
  expect(planningAgent).toContain('Attach a verification method to every acceptance item.');
  expect(verificationAgent).toContain('Translate the evidence into a clear verification basis when the report needs it.');
  expect(verificationAgent).toContain('Do not replace plan-time verification methods; instead confirm whether the planned methods were actually satisfied.');
});

test('reporting guidance covers per-item attainment', () => {
  const reportingSkill = readText('.agents/skills/attainment-reporting/SKILL.md');
  const reportingAgent = readText('.codex/agents/reporting.md');

  expect(reportingSkill).toContain('Source issue');
  expect(reportingSkill).toContain('Why it matters');
  expect(reportingSkill).toContain('Verification basis');
  expect(reportingSkill).toContain('Guarantee limits');
  expect(reportingSkill).toContain('Outstanding gaps');
  expect(reportingSkill).toContain('Map each acceptance item to `done`, `partial`, or `not done`.');
  expect(reportingSkill).toContain('what was better than manual work');
  expect(reportingSkill).toContain('what remained insufficient');
  expect(reportingAgent).toContain('PR report is an acceptance judgment document, not a work log.');
  expect(reportingAgent).toContain('Source issue');
  expect(reportingAgent).toContain('Why it matters');
  expect(reportingAgent).toContain('Verification basis');
  expect(reportingAgent).toContain('Guarantee limits');
  expect(reportingAgent).toContain('Outstanding gaps');
  expect(reportingAgent).toContain('Map each acceptance item to `done`, `partial`, or `not done`.');
  expect(reportingAgent).toContain('Produce a clear follow-up recommendation when something remains incomplete.');
  expect(readText('AGENTS.md')).toContain('All assistant-user conversation in this repository must be in Japanese.');
  expect(readText('AGENTS.md')).toContain('Reports MUST use an itemized structure with `acceptance item`, `status`, `evidence`, and `gap`.');
});

test('.codex/config.toml routes developer workflows to repo-local guidance', () => {
  const config = readText('.codex/config.toml');

  expect(config).toContain('developer_only = true');
  expect(config).toContain('preferred_workflows = ["planning", "verification", "reporting"]');
  expect(config).toContain('planning = ".codex/agents/planning.md"');
  expect(config).toContain('verification = ".codex/agents/verification.md"');
  expect(config).toContain('reporting = ".codex/agents/reporting.md"');
});
