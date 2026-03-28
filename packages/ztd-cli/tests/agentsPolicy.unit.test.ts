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
  expect(contents).toContain('Final PR text and final implementation reports MUST keep those fields visible per acceptance item.');
  expect(contents).toContain('Global summary sections MUST NOT replace per-item status, evidence, or gap.');
  expect(contents).toContain('GitHub-facing reports MUST NOT use local filesystem links such as `/C:/...`; use repo-relative references or plain text.');
  expect(contents).toContain('If a GitHub-facing report contains a local filesystem path, final form is incomplete.');
  expect(contents).toContain('Reports MUST distinguish `tests were updated` from `tests passed`.');
  expect(contents).toContain('If execution is blocked or not run, the affected item MUST remain `partial` or `not done`.');
  expect(contents).toContain('Plans MUST state the `Source issue` and `Why it matters`.');
  expect(contents).toContain('Reports MUST state the `Source request` or `Source issue` and `Why it matters` before item-level status.');
  expect(contents).toContain('Reports MUST state `What changed` before file inventory or file lists.');
  expect(contents).toContain('Reports MUST state the `Verification basis` and `Guarantee limits` when evidence does not fully close an item.');
  expect(contents).toContain('Reports MUST state `Outstanding gaps` explicitly.');
  expect(contents).toContain('Reports MUST end with `What the human should decide next`.');
  expect(contents).toContain('`What changed` MUST describe user-facing or reviewer-facing meaning before implementation detail or file names.');
  expect(contents).toContain('`Verification basis` MUST state what observation was treated as sufficient to call the shape or item satisfied.');
  expect(contents).toContain('`What the human should decide next` SHOULD be phrased as a narrow choice whenever possible.');
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
  expect(contents).toContain('Final PR text and final implementation reports MUST keep those fields visible per acceptance item.');
  expect(contents).toContain('Global summary sections MUST NOT replace per-item status, evidence, or gap.');
  expect(contents).toContain('GitHub-facing reports MUST NOT use local filesystem links such as `/C:/...`; use repo-relative references or plain text.');
  expect(contents).toContain('If a GitHub-facing report contains a local filesystem path, final form is incomplete.');
  expect(contents).toContain('Reports MUST distinguish `tests were updated` from `tests passed`.');
  expect(contents).toContain('If execution is blocked or not run, the affected item MUST remain `partial` or `not done`.');
  expect(contents).toContain('Plans MUST state the `Source issue` and `Why it matters`.');
  expect(contents).toContain('Reports MUST state the `Source request` or `Source issue` and `Why it matters` before item-level status.');
  expect(contents).toContain('Reports MUST state `What changed` before file inventory or file lists.');
  expect(contents).toContain('Reports MUST make `Verification basis`, `Guarantee limits`, and `Outstanding gaps` visible when needed.');
  expect(contents).toContain('Reports MUST end with `What the human should decide next`.');
  expect(contents).toContain('`What changed` MUST describe user-facing or reviewer-facing meaning before implementation detail or file names.');
  expect(contents).toContain('`Verification basis` MUST state what observation was treated as sufficient to call the shape or item satisfied.');
  expect(contents).toContain('`What the human should decide next` SHOULD be phrased as a narrow choice whenever possible.');
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
