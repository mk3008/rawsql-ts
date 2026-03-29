import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

test('ztd-cli pack output ships the gitignore template needed by init', { timeout: 60_000 }, () => {
  const output =
    process.platform === 'win32'
      ? execFileSync('cmd.exe', ['/c', 'npm', 'pack', '--dry-run', '--json', '--ignore-scripts'], {
          cwd: path.join(repoRoot, 'packages', 'ztd-cli'),
          encoding: 'utf8'
        })
      : execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
          cwd: path.join(repoRoot, 'packages', 'ztd-cli'),
          encoding: 'utf8'
        });
  const manifest = JSON.parse(output) as Array<{
    files: Array<{ path: string }>;
  }>;
  const packedFiles = new Set(manifest.flatMap((entry) => entry.files.map((file) => file.path)));

  expect(packedFiles.has('templates/gitignore.template')).toBe(true);
  expect(packedFiles.has('templates/.gitignore')).toBe(false);
});
