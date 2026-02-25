import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runCli } from '../src/cli';

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('ddl-docs-vitepress init', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('scaffolds into an empty target directory', async () => {
    const tempRoot = createTempDir('ddl-docs-vitepress-init-empty-');
    const target = path.join(tempRoot, 'site');
    tempRoots.push(tempRoot);

    await runCli(['init', target]);

    expect(fs.existsSync(path.join(target, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(target, '.gitignore'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'gitignore'))).toBe(false);
  });

  it('fails for non-empty target directory without --force', async () => {
    const tempRoot = createTempDir('ddl-docs-vitepress-init-safe-');
    const target = path.join(tempRoot, 'site');
    tempRoots.push(tempRoot);

    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'package.json'), '{"name":"existing-project"}\n');

    await expect(runCli(['init', target])).rejects.toThrow(/--force/);

    const current = fs.readFileSync(path.join(target, 'package.json'), 'utf8');
    expect(current).toContain('existing-project');
  });

  it('overwrites scaffold files in a non-empty directory with --force', async () => {
    const tempRoot = createTempDir('ddl-docs-vitepress-init-force-');
    const target = path.join(tempRoot, 'site');
    tempRoots.push(tempRoot);

    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'package.json'), '{"name":"existing-project"}\n');
    fs.writeFileSync(path.join(target, 'keep.txt'), 'preserve-me\n');

    await runCli(['init', target, '--force']);

    const packageJson = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8')) as {
      name: string;
    };
    expect(packageJson.name).toBe('db-docs');
    expect(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8')).toContain('preserve-me');
  });

  it('deletes non-template files with --force --clean', async () => {
    const tempRoot = createTempDir('ddl-docs-vitepress-init-clean-');
    const target = path.join(tempRoot, 'site');
    tempRoots.push(tempRoot);

    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'keep.txt'), 'remove-me\n');
    fs.mkdirSync(path.join(target, 'notes'), { recursive: true });
    fs.writeFileSync(path.join(target, 'notes', 'memo.md'), '# memo\n');

    await runCli(['init', target, '--force', '--clean']);

    expect(fs.existsSync(path.join(target, 'keep.txt'))).toBe(false);
    expect(fs.existsSync(path.join(target, 'notes'))).toBe(false);
    expect(fs.existsSync(path.join(target, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(target, '.gitignore'))).toBe(true);
  });

  it('fails when --clean is provided without --force', async () => {
    const tempRoot = createTempDir('ddl-docs-vitepress-init-clean-invalid-');
    const target = path.join(tempRoot, 'site');
    tempRoots.push(tempRoot);

    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'keep.txt'), 'remove-me\n');

    await expect(runCli(['init', target, '--clean'])).rejects.toThrow(/requires --force/);
  });

  it('supports help command and init help option', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(runCli(['help'])).resolves.toBeUndefined();
      await expect(runCli(['init', '--help'])).resolves.toBeUndefined();
    } finally {
      logSpy.mockRestore();
    }
  });
});
