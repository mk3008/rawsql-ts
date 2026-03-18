import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const rootAgentsPath = resolve(repoRoot, 'AGENTS.md');
const visibleMirrorPath = resolve(repoRoot, '.agent/AGENTS.md');

function readPolicy(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

test('root AGENTS.md defines MUST and REQUIRED as completion criteria', () => {
  const contents = readPolicy(rootAgentsPath);

  expect(contents).toContain('## Interpretation');
  expect(contents).toContain('`MUST` and `REQUIRED` define completion criteria.');
  expect(contents).toContain('`ALLOWED` means permitted but not required.');
  expect(contents).toContain('`PROHIBITED` means disallowed unless a narrower rule explicitly allows it.');
  expect(contents).toContain('User requests can add context, but they do not relax a `MUST` or `REQUIRED` rule by default.');
});

test('.agent/AGENTS.md mirrors the completion-criteria policy', () => {
  const contents = readPolicy(visibleMirrorPath);

  expect(contents).toContain('Visible Policy Mirror');
  expect(contents).toContain('`MUST` and `REQUIRED` define completion criteria.');
  expect(contents).toContain('repository root policy remains canonical');
  expect(contents).toContain('Repository implementation is only complete when the required verification and tests that the policy calls for are included in the same change.');
});

test('policy precedence is described without weakening completion criteria', () => {
  const rootContents = readPolicy(rootAgentsPath);
  const mirrorContents = readPolicy(visibleMirrorPath);

  expect(rootContents).toContain('deeper `AGENTS.md` both apply');
  expect(rootContents).toContain('may narrow scope only if it does not weaken a completion criterion');
  expect(mirrorContents).toContain('deeper files may only narrow scope without weakening completion criteria');
});
