import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { findNearestPackageRoot, findWorkspaceRoot } from '../src/utils/optionalDependencies';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  mkdirSync(tmpRoot, { recursive: true });
  return path.join(tmpRoot, `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

test('findNearestPackageRoot resolves a consumer package without requiring pnpm-workspace.yaml', () => {
  const workspace = createTempDir('optional-deps-consumer');
  const packageDir = path.join(workspace, 'node_modules', '@rawsql-ts', 'ztd-cli');
  const nestedDir = path.join(packageDir, 'dist', 'utils');

  mkdirSync(nestedDir, { recursive: true });
  writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ name: 'consumer-app' }, null, 2), 'utf8');
  writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name: '@rawsql-ts/ztd-cli' }, null, 2), 'utf8');

  expect(findNearestPackageRoot(nestedDir)).toBe(packageDir);
  expect(findWorkspaceRoot(nestedDir)).toBe(repoRoot);
});

test('findWorkspaceRoot still detects the rawsql-ts monorepo root when present', () => {
  const nestedDir = path.join(repoRoot, 'packages', 'ztd-cli', 'dist', 'utils');

  mkdirSync(nestedDir, { recursive: true });

  expect(findWorkspaceRoot(nestedDir)).toBe(repoRoot);
});
