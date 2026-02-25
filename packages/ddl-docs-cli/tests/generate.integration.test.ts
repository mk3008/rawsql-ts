import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { runGenerateDocs } from '../src/commands/generate';
import { normalizeLineEndings } from './utils/normalize';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const tmpRoot = path.join(repoRoot, 'tmp');

function createTempDir(prefix: string): string {
  if (!existsSync(tmpRoot)) {
    mkdirSync(tmpRoot, { recursive: true });
  }
  return mkdtempSync(path.join(tmpRoot, `${prefix}-`));
}

test('generate writes table pages, index pages, and warnings metadata', () => {
  const work = createTempDir('ddl-docs-generate');
  const ddlDir = path.join(work, 'ddl');
  const outDir = path.join(work, 'docs');
  mkdirSync(ddlDir, { recursive: true });

  writeFileSync(
    path.join(ddlDir, 'public.sql'),
    `
      CREATE TABLE public.users (
        id bigserial PRIMARY KEY,
        email text NOT NULL
      );
      COMMENT ON TABLE public.users IS 'users table';
      CREATE VIEW public.user_emails AS SELECT email FROM public.users;
    `,
    'utf8'
  );

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

  const tableDoc = path.join(outDir, 'public', 'users.md');
  const schemaIndex = path.join(outDir, 'public', 'index.md');
  const rootIndex = path.join(outDir, 'index.md');
  const globalColumnsIndex = path.join(outDir, 'columns', 'index.md');
  const manifest = path.join(outDir, '_meta', 'manifest.json');
  const warnings = path.join(outDir, '_meta', 'warnings.json');

  expect(existsSync(tableDoc)).toBe(true);
  expect(existsSync(schemaIndex)).toBe(true);
  expect(existsSync(rootIndex)).toBe(true);
  expect(existsSync(globalColumnsIndex)).toBe(true);
  expect(existsSync(manifest)).toBe(true);
  expect(existsSync(warnings)).toBe(true);

  const tableText = normalizeLineEndings(readFileSync(tableDoc, 'utf8'));
  expect(tableText).toContain('## Overview');
  expect(tableText).toContain('## Indexes & Constraints');
  expect(tableText).toContain('## References');
  expect(tableText).toContain('[Table Index](./index.md)');
  expect(tableText.endsWith('\n')).toBe(true);

  const globalColumnsText = normalizeLineEndings(readFileSync(globalColumnsIndex, 'utf8'));
  expect(globalColumnsText).toContain('# Column Index (Alerts)');

  const warningsJson = JSON.parse(readFileSync(warnings, 'utf8')) as Array<{ kind: string }>;
  expect(warningsJson).toHaveLength(0);
});

test('strict mode fails when warnings exist', () => {
  const work = createTempDir('ddl-docs-strict');
  const ddlDir = path.join(work, 'ddl');
  const outDir = path.join(work, 'docs');
  mkdirSync(ddlDir, { recursive: true });

  writeFileSync(
    path.join(ddlDir, 'public.sql'),
    `
      CREATE TABLE public.users (id int PRIMARY KEY);
      CREATE POLICY users_policy ON public.users USING (true);
    `,
    'utf8'
  );

  expect(() =>
    runGenerateDocs({
      ddlDirectories: [ddlDir],
      ddlFiles: [],
      ddlGlobs: [],
      extensions: ['.sql'],
      outDir,
      includeIndexes: true,
      strict: true,
      dialect: 'postgres',
      columnOrder: 'definition',
    })
  ).toThrow(/Strict mode failed/);
});

test('generate is deterministic for the same input', () => {
  const work = createTempDir('ddl-docs-deterministic');
  const ddlDir = path.join(work, 'ddl');
  const outDir = path.join(work, 'docs');
  mkdirSync(ddlDir, { recursive: true });

  writeFileSync(
    path.join(ddlDir, 'main.sql'),
    `
      CREATE TABLE public.accounts (
        id bigint PRIMARY KEY,
        name text NOT NULL
      );
      CREATE TABLE public.orders (
        id bigint PRIMARY KEY,
        account_id bigint NOT NULL,
        CONSTRAINT orders_account_fk FOREIGN KEY (account_id) REFERENCES public.accounts(id)
      );
    `,
    'utf8'
  );

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
  const firstDigest = hashDirectory(outDir);

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
  const secondDigest = hashDirectory(outDir);

  expect(secondDigest).toBe(firstDigest);
});

test('column order option supports definition and name sorting', () => {
  const work = createTempDir('ddl-docs-column-order');
  const ddlDir = path.join(work, 'ddl');
  const outDirDefinition = path.join(work, 'docs-definition');
  const outDirName = path.join(work, 'docs-name');
  mkdirSync(ddlDir, { recursive: true });

  writeFileSync(
    path.join(ddlDir, 'main.sql'),
    `
      CREATE TABLE public.samples (
        z_col int,
        a_col int,
        m_col int
      );
    `,
    'utf8'
  );

  runGenerateDocs({
    ddlDirectories: [ddlDir],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    outDir: outDirDefinition,
    includeIndexes: true,
    strict: false,
    dialect: 'postgres',
    columnOrder: 'definition',
  });
  runGenerateDocs({
    ddlDirectories: [ddlDir],
    ddlFiles: [],
    ddlGlobs: [],
    extensions: ['.sql'],
    outDir: outDirName,
    includeIndexes: true,
    strict: false,
    dialect: 'postgres',
    columnOrder: 'name',
  });

  const definitionDoc = normalizeLineEndings(readFileSync(path.join(outDirDefinition, 'public', 'samples.md'), 'utf8'));
  const nameDoc = normalizeLineEndings(readFileSync(path.join(outDirName, 'public', 'samples.md'), 'utf8'));

  expect(definitionDoc.indexOf('`z_col`')).toBeLessThan(definitionDoc.indexOf('`a_col`'));
  expect(nameDoc.indexOf('`a_col`')).toBeLessThan(nameDoc.indexOf('`m_col`'));
  expect(nameDoc.indexOf('`m_col`')).toBeLessThan(nameDoc.indexOf('`z_col`'));
});

test('filter-pg-dump fails when no schema DDL remains after filtering', () => {
  const work = createTempDir('ddl-docs-filter-empty');
  const ddlDir = path.join(work, 'ddl');
  const outDir = path.join(work, 'docs');
  mkdirSync(ddlDir, { recursive: true });

  writeFileSync(
    path.join(ddlDir, 'public.sql'),
    `
      SET search_path = public, pg_catalog;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_role;
    `,
    'utf8'
  );

  expect(() =>
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
      filterPgDump: true,
    })
  ).toThrow(/No schema DDL remained after --filter-pg-dump/);
});

function hashDirectory(directoryPath: string): string {
  const hash = createHash('sha256');
  const files = listFiles(directoryPath);
  for (const file of files) {
    const relative = path.relative(directoryPath, file).replace(/\\/g, '/');
    hash.update(relative);
    hash.update('\n');
    hash.update(normalizeLineEndings(readFileSync(file, 'utf8')));
    hash.update('\n');
  }
  return hash.digest('hex');
}

function listFiles(directoryPath: string): string[] {
  const files: string[] = [];
  walk(directoryPath, files);
  return files.sort((a, b) => a.localeCompare(b));
}

function walk(directoryPath: string, files: string[]): void {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      walk(resolved, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(resolved);
    }
  }
}
