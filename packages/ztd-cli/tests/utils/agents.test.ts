import { existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { copyAgentsTemplate } from '../../src/utils/agents';

const tmpRoot = path.join(path.resolve(__dirname, '..', '..', '..'), 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

test('copyAgentsTemplate writes AGENTS.md and falls back to AGENTS_ztd.md when needed', () => {
  const workspace = createTempDir('ztd-agents');
  const first = copyAgentsTemplate(workspace);
  expect(first).toBeTruthy();
  expect(existsSync(path.join(workspace, 'AGENTS.md'))).toBe(true);

  const second = copyAgentsTemplate(workspace);
  expect(second).toBeTruthy();
  expect(existsSync(path.join(workspace, 'AGENTS_ztd.md'))).toBe(true);

  const third = copyAgentsTemplate(workspace);
  expect(third).toBe(null);
});
