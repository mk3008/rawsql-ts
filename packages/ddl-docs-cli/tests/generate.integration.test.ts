import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { runGenerateConceptSite } from '../src/commands/conceptSite';
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
  const vitePressConfig = path.join(outDir, '.vitepress', 'config.mts');
  const vitePressTheme = path.join(outDir, '.vitepress', 'theme', 'style.css');
  const manifest = path.join(outDir, '_meta', 'manifest.json');
  const warnings = path.join(outDir, '_meta', 'warnings.json');

  expect(existsSync(tableDoc)).toBe(true);
  expect(existsSync(schemaIndex)).toBe(true);
  expect(existsSync(rootIndex)).toBe(true);
  expect(existsSync(globalColumnsIndex)).toBe(true);
  expect(existsSync(vitePressConfig)).toBe(true);
  expect(existsSync(vitePressTheme)).toBe(true);
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

  const themeCss = normalizeLineEndings(readFileSync(vitePressTheme, 'utf8'));
  expect(themeCss).toContain('.VPDoc .container');
  expect(themeCss).toContain('font-size: 12px;');
  expect(themeCss).toContain('.VPDoc .aside');

  const manifestJson = JSON.parse(readFileSync(manifest, 'utf8')) as {
    outputs: { assets?: string[] };
  };
  expect(manifestJson.outputs.assets).toContain('.vitepress/theme/style.css');
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

test('generate renders column samples from table docs metadata before comments', () => {
  const work = createTempDir('ddl-docs-table-docs');
  const ddlDir = path.join(work, 'ddl');
  const outDir = path.join(work, 'docs');
  const tableDocsPath = path.join(work, 'table-docs.json');
  mkdirSync(ddlDir, { recursive: true });

  writeFileSync(
    path.join(ddlDir, 'main.sql'),
    `
      CREATE TABLE public.active_rows (
        id bigint PRIMARY KEY,
        source_key_json jsonb NOT NULL
      );
      CREATE INDEX active_rows_source_lookup ON public.active_rows (source_key_json);
      COMMENT ON COLUMN public.active_rows.source_key_json IS 'source key';
    `,
    'utf8'
  );
  writeFileSync(
    tableDocsPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        tables: {
          'public.active_rows': {
            designNotes: ['Active rows are optimized for source-key lookup during processing.'],
            constraints: {
              active_rows_source_lookup: {
                designNotes: ['This index supports the hot source-key lookup path.'],
              },
            },
            columns: {
              source_key_json: {
                sample: { sales_id: 123 },
                designNotes: ['This JSON value is the source of truth for source identity.'],
              },
            },
          },
        },
      },
      null,
      2
    ),
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
    tableDocsPath,
  });

  const tableDoc = normalizeLineEndings(readFileSync(path.join(outDir, 'public', 'active-rows.md'), 'utf8'));
  expect(tableDoc).toContain('| Key | Column | Type | Nullable | Default | Seq | Sample | Comment | Review Notes |');
  expect(tableDoc).toContain('|  | `source_key_json` | `jsonb` | NO | - |  | `{"sales_id":123}` | source key |');
  expect(tableDoc).toContain('## Design Notes');
  expect(tableDoc).toContain('Active rows are optimized for source-key lookup during processing.');
  expect(tableDoc).toContain('This JSON value is the source of truth for source identity.');
  expect(tableDoc).toContain('| Kind | Name | Expression | Review Notes |');
  expect(tableDoc).toContain('This index supports the hot source-key lookup path.');
});

test('generate renders related concept and process pages from relationship metadata', () => {
  const work = createTempDir('ddl-docs-related-sources');
  const ddlDir = path.join(work, 'ddl');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const processesDir = path.join(work, 'docs', 'processes');
  const outDir = path.join(work, 'docs-out');
  const tableDocsPath = path.join(ddlDir, 'table-docs.json');
  const relationshipPath = path.join(ddlDir, 'relationship.json');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');
  mkdirSync(ddlDir, { recursive: true });
  mkdirSync(path.join(conceptsDir, 'active-row'), { recursive: true });
  mkdirSync(processesDir, { recursive: true });

  writeFileSync(
    path.join(ddlDir, 'active_rows.sql'),
    `
      CREATE TABLE public.active_rows (
        id bigint PRIMARY KEY,
        source_key_json jsonb NOT NULL,
        source_key_hash text NOT NULL
      );
      CREATE INDEX active_rows_source_lookup ON public.active_rows (source_key_hash);
    `,
    'utf8'
  );
  writeFileSync(path.join(conceptsDir, 'active-row/SPEC.md'), '# Active Row Concept\n\nDefined concept.', 'utf8');
  writeFileSync(path.join(processesDir, 'active-row-process.md'), '# Active Row Process\n\nDefined process.', 'utf8');
  writeFileSync(
    tableDocsPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        tables: {
          'public.active_rows': {
            decision: 'Use source_key_json as identity.',
            reviewRisk: 'identity-boundary',
            conceptRefs: ['active-row'],
            processRefs: ['active-row-process'],
            tradeoff: ['Hash supports lookup.'],
            alternativesRejected: ['Do not use hash as identity.'],
            columns: {
              source_key_json: { sample: { id: 1 } },
              source_key_hash: { sample: 'sha256:key' },
            },
          },
        },
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(
    relationshipPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        relationships: [
          {
            path: 'active_rows.sql',
            kind: 'table-ddl',
            concepts: [{ path: '../docs/concepts/active-row/SPEC.md', reason: 'Active row current state.' }],
            processes: [{ path: '../docs/processes/active-row-process.md', reason: 'Active row lookup.' }],
          },
        ],
      },
      null,
      2
    ),
    'utf8'
  );
  writeFileSync(
    conceptRelationshipPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        concepts: [
          {
            id: 'active-row',
            displayName: 'Active Row',
            path: 'active-row/SPEC.md',
            status: 'defined',
            summary: 'Active row summary',
          },
          {
            id: 'row-key',
            displayName: 'Row Key',
            path: null,
            status: 'alias',
            summary: 'Row identity explanation term.',
            note: 'Not an authoritative Concept Spec.',
          },
        ],
        relationships: [
          {
            from: 'active-row',
            to: 'row-key',
            kind: 'uses',
            reason: 'Active row uses row key terminology.',
          },
        ],
        glossaryTerms: [
          {
            id: 'active-row-key',
            displayTerm: 'active row key',
            definedIn: ['active-row/SPEC.md'],
            meaning: 'Logical active row identity.',
            note: 'Generated review-map metadata.',
          },
        ],
        relatedProcessMaps: [
          {
            id: 'active-row-process',
            displayName: 'Active Row Process',
            path: '../processes/active-row-process.md',
            reason: 'Process map linked from concept metadata.',
          },
        ],
      },
      null,
      2
    ),
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
    tableDocsPath,
    relationshipPath,
    conceptRelationshipPath,
  });

  const tableDoc = normalizeLineEndings(readFileSync(path.join(outDir, 'public', 'active-rows.md'), 'utf8'));
  expect(tableDoc).toContain('## Related Concepts / Processes');
  expect(tableDoc).toContain('[active-row](../concepts/active-row.md)');
  expect(tableDoc).toContain('[active-row-process](../processes/active-row-process.md)');
  expect(tableDoc).toContain('decision: Use source_key_json as identity.');
  expect(tableDoc).toContain('alternativesRejected: Do not use hash as identity.');

  const conceptDoc = normalizeLineEndings(readFileSync(path.join(outDir, 'concepts', 'active-row.md'), 'utf8'));
  expect(conceptDoc).toContain('# Active Row');
  expect(conceptDoc).toContain('This page is a generated human review view.');
  expect(conceptDoc).toContain('## Related Concepts');
  expect(conceptDoc).toContain('| outgoing | `uses` | `row-key` | Active row uses row key terminology. |');
  expect(conceptDoc).toContain('## Glossary Terms Defined Here');
  expect(conceptDoc).toContain('active-row-key');
  expect(conceptDoc).toContain('Defined concept.');

  const processDoc = normalizeLineEndings(readFileSync(path.join(outDir, 'processes', 'active-row-process.md'), 'utf8'));
  expect(processDoc).toContain('# active-row-process');
  expect(processDoc).toContain('Defined process.');

  const conceptIndex = normalizeLineEndings(readFileSync(path.join(outDir, 'concepts', 'index.md'), 'utf8'));
  expect(conceptIndex).toContain('# Concept Map');
  expect(conceptIndex).toContain('| [active-row](./active-row.md) | Active Row | `defined` | Active row summary |');
  expect(conceptIndex).toContain('## Glossary Terms');
  expect(conceptIndex).toContain('active-row-key');
  expect(conceptIndex).toContain('## Planned Or Candidate Concepts');
  expect(conceptIndex).toContain('row-key');
  expect(conceptIndex).toContain('## Relationships');
  expect(conceptIndex).toContain('| [active-row](./active-row.md) | `uses` | `row-key` | Active row uses row key terminology. |');
});

test('concept-site generates VitePress concept and process pages without DDL input', () => {
  const work = createTempDir('ddl-docs-concept-site');
  const conceptsDir = path.join(work, 'docs', 'concepts');
  const processesDir = path.join(work, 'docs', 'processes');
  const outDir = path.join(work, 'site');
  const conceptRelationshipPath = path.join(conceptsDir, 'concept-relationship.json');
  mkdirSync(path.join(conceptsDir, 'active-row'), { recursive: true });
  mkdirSync(processesDir, { recursive: true });

  writeFileSync(path.join(conceptsDir, 'active-row/SPEC.md'), '# Active Row Concept\n\nDefined concept.', 'utf8');
  writeFileSync(path.join(processesDir, 'active-row-process.md'), '# Active Row Process\n\nDefined process.', 'utf8');
  writeFileSync(
    conceptRelationshipPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        concepts: [
          {
            id: 'active-row',
            displayName: 'Active Row',
            path: 'active-row/SPEC.md',
            status: 'defined',
            summary: 'Active row summary',
          },
          {
            id: 'row-key',
            displayName: 'Row Key',
            path: null,
            status: 'alias',
            summary: 'Row identity explanation term.',
          },
        ],
        relationships: [
          {
            from: 'active-row',
            to: 'row-key',
            kind: 'uses',
            reason: 'Active row uses row key terminology.',
          },
        ],
        relatedProcessMaps: [
          {
            id: 'active-row-process',
            displayName: 'Active Row Process',
            path: '../processes/active-row-process.md',
            reason: 'Process map linked from concept metadata.',
          },
        ],
      },
      null,
      2
    ),
    'utf8'
  );

  runGenerateConceptSite({
    conceptRelationshipPath,
    outDir,
  });

  const conceptIndex = normalizeLineEndings(readFileSync(path.join(outDir, 'concepts', 'index.md'), 'utf8'));
  expect(conceptIndex).toContain('# Concept Map');
  expect(conceptIndex).toContain('| [active-row](./active-row.md) | Active Row | `defined` | Active row summary |');
  expect(conceptIndex).toContain('| [active-row](./active-row.md) | `uses` | `row-key` | Active row uses row key terminology. |');

  const conceptDoc = normalizeLineEndings(readFileSync(path.join(outDir, 'concepts', 'active-row.md'), 'utf8'));
  expect(conceptDoc).toContain('# Active Row');
  expect(conceptDoc).toContain('## Related Concepts');
  expect(conceptDoc).toContain('Defined concept.');

  const processIndex = normalizeLineEndings(readFileSync(path.join(outDir, 'processes', 'index.md'), 'utf8'));
  expect(processIndex).toContain('[active-row-process](./active-row-process.md)');
  const rootIndex = normalizeLineEndings(readFileSync(path.join(outDir, 'index.md'), 'utf8'));
  expect(rootIndex).toContain('# Concept Spec Review');
  expect(rootIndex).toContain('[Concepts](./concepts/)');
  const vitePressConfig = normalizeLineEndings(readFileSync(path.join(outDir, '.vitepress', 'config.mts'), 'utf8'));
  expect(vitePressConfig).toContain('title: "Concept Spec Review"');
  expect(existsSync(path.join(outDir, '.vitepress', 'config.mts'))).toBe(true);
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

test('filter-pg-dump succeeds when schema DDL remains after filtering', () => {
  const work = createTempDir('ddl-docs-filter-success');
  const ddlDir = path.join(work, 'ddl');
  const outDir = path.join(work, 'docs');
  mkdirSync(ddlDir, { recursive: true });

  writeFileSync(
    path.join(ddlDir, 'public.sql'),
    `
      SET search_path = public, pg_catalog;
      CREATE TABLE public.items (
        id bigserial PRIMARY KEY,
        name text NOT NULL
      );
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
      includeIndexes: false,
      strict: false,
      dialect: 'postgres',
      columnOrder: 'definition',
      filterPgDump: true,
    })
  ).not.toThrow();

  expect(existsSync(path.join(outDir, 'public', 'items.md'))).toBe(true);
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
