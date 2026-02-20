import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sqlCatalogCases, testCaseCatalogs } from './specs';

describe('specs entrypoint', () => {
  it('exports at least one test-case catalog and one SQL catalog spec', () => {
    expect(Array.isArray(testCaseCatalogs)).toBe(true);
    expect(Array.isArray(sqlCatalogCases)).toBe(true);
    expect(testCaseCatalogs.length).toBeGreaterThan(0);
    expect(sqlCatalogCases.length).toBeGreaterThan(0);
  });

  it('keeps spec modules free from vitest blocks by convention', () => {
    const specsRoot = path.resolve(__dirname, 'specs');
    const sourceFiles = [
      path.join(specsRoot, 'index.ts'),
      path.join(specsRoot, 'testCaseCatalogs.ts'),
      path.join(specsRoot, 'sql', 'activeOrders.ts'),
    ];
    for (const filePath of sourceFiles) {
      const source = readFileSync(filePath, 'utf8');
      expect(source).not.toMatch(/\b(?:describe|it|test)\s*\(/);
    }
  });

  it('removes legacy SQL catalog alias names from ztd-cli files', () => {
    const packageRoot = path.resolve(__dirname, '..');
    const legacyDefineName = ['define', 'SqlCatalog', 'Cases'].join('');
    const legacyRunName = ['run', 'SqlCatalog', 'Cases'].join('');
    const sourceFiles = collectFiles(path.join(packageRoot, 'src')).concat(
      collectFiles(path.join(packageRoot, 'tests'))
    );

    for (const filePath of sourceFiles) {
      const source = readFileSync(filePath, 'utf8');
      expect(source.includes(legacyDefineName), filePath).toBe(false);
      expect(source.includes(legacyRunName), filePath).toBe(false);
    }
  });
});

function collectFiles(rootDir: string): string[] {
  if (!statSync(rootDir).isDirectory()) {
    return [];
  }
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
      continue;
    }
    if (entry.isFile() && /\.(?:ts|tsx|mts|cts|js|mjs|cjs|md)$/i.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}
