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

  expect(rootAgents).toContain('# INTENT');
  expect(rootAgents).toContain('Source assets stay human-owned so the repository keeps a clear edit surface.');
  expect(rootAgents).toContain('# procedure');
  expect(rootAgents).toContain('Follow `DDL -> SQL -> generate -> wire -> test` when moving from source assets to downstream artifacts.');

  expect(mirrorAgents).toContain('## INTENT');
  expect(mirrorAgents).toContain('## procedure');
  expect(mirrorAgents).toContain('Downstream artifacts exist to match the source assets, not to replace their intent.');
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
