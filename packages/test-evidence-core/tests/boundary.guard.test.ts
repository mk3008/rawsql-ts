import { expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const coreSrcDir = path.resolve(__dirname, '..', 'src');

function walkSourceFiles(rootDir: string): string[] {
  const files: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile() && absolute.endsWith('.ts')) {
        files.push(absolute);
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

test('core source does not import node IO modules or renderer package', () => {
  const forbiddenPatterns: RegExp[] = [
    /from\s+['"]node:fs['"]/,
    /from\s+['"]node:path['"]/,
    /\breadFileSync\b/,
    /\bwriteFileSync\b/,
    /from\s+['"]@rawsql-ts\/test-evidence-renderer-md['"]/,
    /from\s+['"]@rawsql-ts\/test-evidence-renderer-md\/.+['"]/,
    /from\s+['"]\.\.?\/.*renderer/i
  ];

  const violations: string[] = [];
  for (const filePath of walkSourceFiles(coreSrcDir)) {
    const source = readFileSync(filePath, 'utf8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(source)) {
        violations.push(`${path.relative(coreSrcDir, filePath)} matched ${pattern}`);
      }
    }
  }

  expect(violations).toEqual([]);
});
