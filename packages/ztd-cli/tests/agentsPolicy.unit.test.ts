import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const rootAgentsPath = resolve(repoRoot, 'AGENTS.md');
const visibleMirrorPath = resolve(repoRoot, '.agent/AGENTS.md');

function readPolicy(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

test('root AGENTS.md defines global guardrails and routing', () => {
  const contents = readPolicy(rootAgentsPath);

  expect(contents).toContain('## Interpretation');
  expect(contents).toContain('`MUST` and `REQUIRED` define completion criteria.');
  expect(contents).toContain('`ALLOWED` means permitted but not required.');
  expect(contents).toContain('`PROHIBITED` means disallowed unless a narrower rule explicitly allows it.');
  expect(contents).toContain('This repository is for rawsql-ts developers only.');
  expect(contents).toContain('All assistant-user conversation in this repository must be in Japanese.');
  expect(contents).toContain('Reports MUST use an itemized structure with `acceptance item`, `status`, `evidence`, and `gap`.');
  expect(contents).toContain('.codex/agents/planning.md');
  expect(contents).toContain('.agents/skills/acceptance-planning/SKILL.md');
});

test('.agent/AGENTS.md mirrors the routing and guardrail policy', () => {
  const contents = readPolicy(visibleMirrorPath);

  expect(contents).toContain('Visible Policy Mirror');
  expect(contents).toContain('`MUST` and `REQUIRED` define completion criteria.');
  expect(contents).toContain('repository root policy remains canonical');
  expect(contents).toContain('All assistant-user conversation in this repository must be in Japanese.');
  expect(contents).toContain('Reports MUST use an itemized structure with `acceptance item`, `status`, `evidence`, and `gap`.');
  expect(contents).toContain('.codex/agents/planning.md');
  expect(contents).toContain('.agents/skills/attainment-reporting/SKILL.md');
});

test('policy precedence is described without weakening completion criteria', () => {
  const rootContents = readPolicy(rootAgentsPath);
  const mirrorContents = readPolicy(visibleMirrorPath);

  expect(rootContents).toContain('When this file and a deeper `AGENTS.md` both apply');
  expect(rootContents).toContain('may narrow scope only if it does not weaken a completion criterion');
  expect(mirrorContents).toContain('deeper files may only narrow scope without weakening completion criteria');
});
