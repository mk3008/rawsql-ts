import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readNormalizedFile(relativePath: string): string {
  const filePath = path.join(repoRoot, relativePath);
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function expectInOrder(haystack: string, needles: string[]): void {
  let cursor = 0;
  for (const needle of needles) {
    const index = haystack.indexOf(needle, cursor);
    expect(index, `Expected to find "${needle}" after offset ${cursor}`).toBeGreaterThanOrEqual(0);
    cursor = index + needle.length;
  }
}

test('root policy and mirror describe intent and procedure as causality', () => {
  const rootAgents = readNormalizedFile('AGENTS.md');
  const mirrorAgents = readNormalizedFile('.agent/AGENTS.md');

  expect(rootAgents).toContain('# Repository Scope');
  expect(rootAgents).toContain('Use the repo-local guidance under `.codex/agents/` and `.agents/skills/` for planning, verification, review, and reporting details.');
  expect(rootAgents).toContain('Keep assistant-user conversation in Japanese in this repository.');
  expect(rootAgents).toContain('Plans must state the source issue or request, acceptance items, verification methods, and explicit out-of-scope items when scope is limited.');

  expect(mirrorAgents).toContain('# Visible Policy Mirror');
  expect(mirrorAgents).toContain('Use `.codex/agents/planning.md`, `.codex/agents/verification.md`, `.codex/agents/review.md`, and `.codex/agents/reporting.md` for developer workflow support.');
  expect(mirrorAgents).toContain('Use `.agents/skills/acceptance-planning/SKILL.md`, `.agents/skills/self-review/SKILL.md`, and `.agents/skills/attainment-reporting/SKILL.md` for repeatable planning, review, and reporting workflows.');
});

test('README exposes the high-level intent and procedure entry point', () => {
  const readme = readNormalizedFile('README.md');

  expectInOrder(readme, [
    '## Tutorials',
    'SQL-first End-to-End Tutorial',
    '## Intent and Procedure',
    'Use this repo by treating DDL and SQL as source assets, and generated specs, repositories, and tests as downstream artifacts that must stay in sync.',
    'Procedure: `DDL -> SQL -> generate -> wire -> test`.',
    'For a step-by-step example, see the SQL-first tutorial above.',
  ]);
});
