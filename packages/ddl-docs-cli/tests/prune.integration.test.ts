import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { runGenerateDocs } from '../src/commands/generate';
import { runPruneDocs } from '../src/commands/prune';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

test('prune keeps handwritten markdown and supports dry-run', () => {
  const work = createTempDir('ddl-docs-prune');
  const ddlDir = path.join(work, 'ddl');
  const outDir = path.join(work, 'docs');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    path.join(ddlDir, 'public.sql'),
    `
      CREATE TABLE users (
        id int PRIMARY KEY
      );
    `,
    'utf8'
  );

  const manualFile = path.join(outDir, 'README.md');
  writeFileSync(manualFile, '# manual file\n', 'utf8');

  runGenerateDocs({
    ddlDirectories: [ddlDir],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    outDir,
    includeIndexes: true,
    strict: false,
    dialect: 'postgres',
    columnOrder: 'definition',
  });

  const generatedTableFile = path.join(outDir, 'public', 'users.md');
  expect(existsSync(generatedTableFile)).toBe(true);

  runPruneDocs({ outDir, dryRun: true, pruneOrphans: false });
  expect(existsSync(generatedTableFile)).toBe(true);
  expect(existsSync(manualFile)).toBe(true);

  runPruneDocs({ outDir, dryRun: false, pruneOrphans: false });
  expect(existsSync(generatedTableFile)).toBe(false);
  expect(existsSync(path.join(outDir, '_meta', 'manifest.json'))).toBe(false);
  expect(existsSync(manualFile)).toBe(true);
});

test('prune-orphans only removes files with generated header', () => {
  const work = createTempDir('ddl-docs-prune-orphans');
  const ddlDir = path.join(work, 'ddl');
  const outDir = path.join(work, 'docs');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  writeFileSync(path.join(ddlDir, 'public.sql'), `CREATE TABLE users (id int PRIMARY KEY);`, 'utf8');

  runGenerateDocs({
    ddlDirectories: [ddlDir],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    outDir,
    includeIndexes: true,
    strict: false,
    dialect: 'postgres',
    columnOrder: 'definition',
  });

  const orphanGenerated = path.join(outDir, 'public', 'orphan.md');
  const orphanManual = path.join(outDir, 'public', 'manual.md');
  writeFileSync(orphanGenerated, '<!-- generated-by: @rawsql-ts/ddl-docs-cli -->\n\n# orphan\n', 'utf8');
  writeFileSync(orphanManual, '# manual orphan\n', 'utf8');

  runPruneDocs({ outDir, dryRun: false, pruneOrphans: true });
  expect(existsSync(orphanGenerated)).toBe(false);
  expect(existsSync(orphanManual)).toBe(true);
});
