import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readDoc(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

test('finding registry docs point to the example registry and lifecycle states', () => {
  const guide = readDoc('docs/guide/finding-registry.md');
  const inventory = readDoc('docs/guide/ztd-cli-measurement-inventory.md');

  expect(guide).toContain('finding-registry.example.json');
  expect(guide).toContain('planned');
  expect(guide).toContain('verified');
  expect(inventory).toContain('Finding Registry');
  expect(inventory).toContain('finding-registry.md');
});
