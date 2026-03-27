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

  expect(planningSkill).toContain('Draft acceptance items and verification methods');
  expect(planningSkill).toContain('Acceptance items');
  expect(planningSkill).toContain('Verification methods');
  expect(planningAgent).toContain('Write testable acceptance items');
  expect(planningAgent).toContain('Attach a verification method to every acceptance item.');
});

test('reporting guidance covers per-item attainment', () => {
  const reportingSkill = readText('.agents/skills/attainment-reporting/SKILL.md');
  const reportingAgent = readText('.codex/agents/reporting.md');

  expect(reportingSkill).toContain('Map each acceptance item to `done`, `partial`, or `not done`.');
  expect(reportingSkill).toContain('what was better than manual work');
  expect(reportingSkill).toContain('what remained insufficient');
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
