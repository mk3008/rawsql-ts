import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readNormalizedFile(relativePath: string): string {
  const filePath = path.join(repoRoot, relativePath);
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

test('readmes promote the feature-first layout without tables/views taxonomy', () => {
  const rootReadme = readNormalizedFile('README.md');
  const packageReadme = readNormalizedFile('packages/ztd-cli/README.md');
  const scaffoldReadme = readNormalizedFile('packages/ztd-cli/templates/README.md');
  const featuresReadme = readNormalizedFile('packages/ztd-cli/templates/src/features/README.md');
  const smokeReadme = readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/README.md');

  for (const doc of [rootReadme, packageReadme, scaffoldReadme, featuresReadme, smokeReadme]) {
    expect(doc).toContain('src/features');
    expect(doc).toContain('smoke');
    expect(doc).not.toContain('tables/views');
  }

  expect(rootReadme).toContain('feature-first');
  expect(packageReadme).toContain('feature-first');
  expect(scaffoldReadme).toContain('feature-first');
  expect(featuresReadme).toContain('smoke');
  expect(smokeReadme).toContain('starter-only sample feature');
  expect(rootReadme).toContain('Migration Repair Loop');
  expect(packageReadme).toContain('Quickstart');
  expect(packageReadme).toContain('Getting Started with AI');
  expect(packageReadme).toContain('Core features');
  expect(packageReadme).toContain('Commands');
  expect(packageReadme).toContain('Glossary');
  expect(packageReadme).toContain('Further Reading');
  expect(packageReadme).toContain('@rawsql-ts/testkit-core');
  expect(packageReadme).toContain('@rawsql-ts/testkit-postgres');
  expect(readNormalizedFile('docs/guide/sql-first-end-to-end-tutorial.md')).toContain('Scenario CLI at a glance');
  expect(readNormalizedFile('docs/dogfooding/ztd-migration-lifecycle.md')).toContain('Preferred CLI by scenario');
  expect(packageReadme).toContain('Advanced validation, dogfooding, and tuning live in [Further Reading](#further-reading).');
  expect(packageReadme).toContain('ztd ztd-config --watch');
  expect(packageReadme).toContain('--dry-run');
  expect(packageReadme).toContain('--output json');
  expect(packageReadme).toContain('TestRowMap');
  expect(packageReadme).toContain('QuerySpec');
  expect(packageReadme).toContain('Run `npx ztd describe command <name>` for per-command flags and options.');
  expect(readNormalizedFile('docs/guide/perf-tuning-decision-guide.md')).toContain(
    'tuning stays evidence-driven and does not require breaking the SQL shape first'
  );
  expect(readNormalizedFile('docs/dogfooding/perf-scale-tuning.md')).toContain(
    'without breaking the SQL unless the evidence shows that SQL shape itself must change'
  );
});

test('feature guidance centers the sample feature and role-based folders', () => {
  const files = [
    'packages/ztd-cli/templates/src/features/AGENTS.md',
    'packages/ztd-cli/templates/src/features/README.md',
    'packages/ztd-cli/templates/src/features/smoke/README.md',
    'packages/ztd-cli/templates/src/features/smoke/persistence/README.md',
    'packages/ztd-cli/templates/src/features/smoke/tests/README.md'
  ];

  for (const file of files) {
    const contents = readNormalizedFile(file);
    expect(contents).toContain('feature');
    expect(contents.toLowerCase()).toContain('smoke');
    expect(contents).not.toContain('tables/views');
  }

  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/AGENTS.md')).toContain('domain');
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/persistence/README.md')).toContain(
    'named-parameter'
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/README.md')).toContain(
    '@rawsql-ts/testkit-postgres'
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/tests/README.md')).toContain(
    'smoke.queryspec.test.ts'
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/features/smoke/tests/README.md')).toContain(
    'createStarterPostgresTestkitClient'
  );
});

test('feature-first scaffold files exist in the template bundle', () => {
  const requiredPaths = [
    'packages/ztd-cli/templates/src/features/README.md',
    'packages/ztd-cli/templates/src/features/AGENTS.md',
    'packages/ztd-cli/templates/src/features/smoke/README.md',
    'packages/ztd-cli/templates/src/features/smoke/application/README.md',
    'packages/ztd-cli/templates/src/features/smoke/domain/README.md',
    'packages/ztd-cli/templates/src/features/smoke/persistence/README.md',
    'packages/ztd-cli/templates/src/features/smoke/tests/README.md',
    'packages/ztd-cli/templates/src/features/smoke/persistence/smoke.sql',
    'packages/ztd-cli/templates/src/features/smoke/persistence/smoke.spec.ts',
    'packages/ztd-cli/templates/src/features/smoke/tests/smoke.test.ts',
    'packages/ztd-cli/templates/src/features/smoke/tests/smoke.validation.test.ts',
    'packages/ztd-cli/templates/src/features/smoke/tests/smoke.queryspec.test.ts'
  ];

  for (const requiredPath of requiredPaths) {
    expect(existsSync(path.join(repoRoot, requiredPath))).toBe(true);
  }
});
