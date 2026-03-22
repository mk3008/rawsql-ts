import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { runCheckContract } from '../src/commands/checkContract';
import { runTestEvidenceSpecification } from '../src/commands/testEvidence';
import {
  discoverProjectSqlCatalogSpecFiles,
  loadSqlCatalogSpecsFromFile,
  walkSqlCatalogSpecFiles
} from '../src/utils/sqlCatalogDiscovery';

function createWorkspace(prefix: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  mkdirSync(path.join(root, 'src', 'catalog', 'specs'), { recursive: true });
  mkdirSync(path.join(root, 'src', 'sql'), { recursive: true });
  mkdirSync(path.join(root, 'tests', 'specs'), { recursive: true });
  return root;
}

test('sql catalog discovery keeps deterministic ordering and excludes .test. files when requested', () => {
  const root = createWorkspace('sql-catalog-discovery');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'b.spec.json'),
    JSON.stringify({ id: 'catalog.b', sqlFile: '../../sql/b.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'a.spec.ts'),
    "export const a = { id: 'catalog.a', sqlFile: '../../sql/a.sql', params: { shape: 'positional', example: [] }, output: { mapping: { prefix: '' } } };",
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'ignored.test.ts'),
    "export const ignored = { id: 'catalog.ignored', sqlFile: '../../sql/ignored.sql', params: { shape: 'named' } };",
    'utf8'
  );

  const allFiles = walkSqlCatalogSpecFiles(path.join(root, 'src', 'catalog', 'specs'));
  const checkFiles = walkSqlCatalogSpecFiles(path.join(root, 'src', 'catalog', 'specs'), { excludeTestFiles: true });

  expect(allFiles.map((filePath) => path.basename(filePath))).toEqual(['a.spec.ts', 'b.spec.json', 'ignored.test.ts']);
  expect(checkFiles.map((filePath) => path.basename(filePath))).toEqual(['a.spec.ts', 'b.spec.json']);
});

test('sql catalog discovery finds feature-local specs under src/features', () => {
  const root = createWorkspace('sql-catalog-features');
  mkdirSync(path.join(root, 'src', 'features', 'smoke', 'persistence', 'generated'), { recursive: true });
  writeFileSync(
    path.join(root, 'src', 'features', 'smoke', 'persistence', 'smoke.spec.ts'),
    "export const smoke = { id: 'features.smoke.persistence.smoke', sqlFile: './smoke.sql', params: { shape: 'named', example: { id: null } } };",
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'features', 'smoke', 'persistence', 'generated', 'smoke.generated.ts'),
    "export const generated = { id: 'features.smoke.persistence.generated', sqlFile: './generated.sql', params: { shape: 'named' } };",
    'utf8'
  );

  const allFiles = walkSqlCatalogSpecFiles(path.join(root, 'src', 'features'));
  const checkFiles = walkSqlCatalogSpecFiles(path.join(root, 'src', 'features'), {
    excludeTestFiles: true,
    excludeGenerated: true
  });

  expect(allFiles.map((filePath) => path.basename(filePath))).toEqual([
    'smoke.generated.ts',
    'smoke.spec.ts'
  ]);
  expect(checkFiles.map((filePath) => path.basename(filePath))).toEqual(['smoke.spec.ts']);
});

test('project-wide spec discovery finds feature-local QuerySpecs without a fixed catalog root', () => {
  const root = createWorkspace('sql-catalog-project-wide');
  mkdirSync(path.join(root, 'src', 'features', 'users', 'persistence'), { recursive: true });
  mkdirSync(path.join(root, 'src', 'features', 'orders', 'persistence'), { recursive: true });
  mkdirSync(path.join(root, 'tests', 'fixtures'), { recursive: true });
  writeFileSync(
    path.join(root, 'src', 'features', 'users', 'persistence', 'users.spec.ts'),
    "export const usersSpec = { id: 'features.users.persistence.users', sqlFile: './users.sql', params: { shape: 'named', example: { id: 1 } } };",
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'features', 'orders', 'persistence', 'orders.spec.ts'),
    "export const ordersSpec = { id: 'features.orders.persistence.orders', sqlFile: './orders.sql', params: { shape: 'named', example: { id: 1 } } };",
    'utf8'
  );
  writeFileSync(
    path.join(root, 'tests', 'fixtures', 'fake.spec.ts'),
    "export const fake = { id: 'tests.fake', sqlFile: './fake.sql', params: { shape: 'named' } };",
    'utf8'
  );

  const discovered = discoverProjectSqlCatalogSpecFiles(root, { excludeTestFiles: true });

  expect(discovered.map((filePath) => path.relative(root, filePath).replace(/\\/g, '/'))).toEqual([
    'src/features/orders/persistence/orders.spec.ts',
    'src/features/users/persistence/users.spec.ts'
  ]);
});

test('sql catalog discovery preserves spec ids, ordering, sqlFile, and minimal extracted fields', () => {
  const root = createWorkspace('sql-catalog-minimal');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'a.spec.ts'),
    "export const a = { id: 'catalog.a', sqlFile: '../../sql/a.sql', params: { shape: 'named', example: { active: 1 } }, output: { mapping: { columnMap: { id: 'user_id' } } } };",
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'b.spec.json'),
    JSON.stringify({ id: 'catalog.b', sqlFile: '../../sql/b.sql', params: { shape: 'positional', example: [] } }, null, 2),
    'utf8'
  );

  const files = walkSqlCatalogSpecFiles(path.join(root, 'src', 'catalog', 'specs'), { excludeTestFiles: true });
  const loaded = files.flatMap((filePath) => loadSqlCatalogSpecsFromFile(filePath, (message) => new Error(message)));

  expect(loaded.map((entry) => ({
    id: entry.spec.id,
    file: path.basename(entry.filePath),
    sqlFile: entry.spec.sqlFile,
    shape: entry.spec.params?.shape,
    hasMapping: entry.spec.output?.mapping !== undefined
  }))).toEqual([
    {
      id: 'catalog.a',
      file: 'a.spec.ts',
      sqlFile: '../../sql/a.sql',
      shape: 'named',
      hasMapping: true
    },
    {
      id: 'catalog.b',
      file: 'b.spec.json',
      sqlFile: '../../sql/b.sql',
      shape: 'positional',
      hasMapping: false
    }
  ]);
});

test('shared discovery keeps runCheckContract behavior unchanged for ts/json specs', () => {
  const root = createWorkspace('sql-catalog-check-contract');
  writeFileSync(path.join(root, 'src', 'sql', 'a.sql'), 'SELECT 1', 'utf8');
  writeFileSync(path.join(root, 'src', 'sql', 'b.sql'), 'SELECT * FROM users', 'utf8');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'a.spec.ts'),
    "export const a = { id: 'catalog.a', sqlFile: '../../sql/a.sql', params: { shape: 'named', example: [] } };",
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'b.spec.json'),
    JSON.stringify({ id: 'catalog.b', sqlFile: '../../sql/b.sql', params: { shape: 'positional', example: [] } }, null, 2),
    'utf8'
  );

  const result = runCheckContract({ strict: true, rootDir: root });
  expect(result).toMatchObject({
    filesChecked: 2,
    specsChecked: 2
  });
  expect(result.violations).toEqual([
    expect.objectContaining({
      rule: 'params-shape-mismatch',
      specId: 'catalog.a'
    }),
    expect.objectContaining({
      rule: 'safety-select-star',
      specId: 'catalog.b'
    })
  ]);
});

test('shared discovery keeps runTestEvidenceSpecification behavior unchanged for mixed spec files', () => {
  const root = createWorkspace('sql-catalog-evidence');
  writeFileSync(path.join(root, 'src', 'sql', 'a.sql'), 'select 1', 'utf8');
  writeFileSync(path.join(root, 'src', 'sql', 'b.sql'), 'select 2', 'utf8');
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'b.spec.json'),
    JSON.stringify({ id: 'catalog.b', sqlFile: '../../sql/b.sql', params: { shape: 'named' } }, null, 2),
    'utf8'
  );
  writeFileSync(
    path.join(root, 'src', 'catalog', 'specs', 'a.spec.ts'),
    "export const a = { id: 'catalog.a', sqlFile: '../../sql/a.sql', params: { shape: 'positional', example: [] }, output: { mapping: { prefix: 'user_' } } };",
    'utf8'
  );
  writeFileSync(
    path.join(root, 'tests', 'specs', 'index.cjs'),
    [
      'module.exports = {',
      '  testCaseCatalogs: [],',
      '  sqlCatalogCases: []',
      '};',
      ''
    ].join('\n'),
    'utf8'
  );

  const report = runTestEvidenceSpecification({ mode: 'specification', rootDir: root });
  expect(report.summary).toMatchObject({
    sqlCatalogCount: 2,
    specFilesScanned: 2
  });
  expect(report.sqlCatalogs).toEqual([
    expect.objectContaining({ id: 'catalog.a', specFile: 'src/catalog/specs/a.spec.ts', paramsShape: 'positional', hasOutputMapping: true }),
    expect.objectContaining({ id: 'catalog.b', specFile: 'src/catalog/specs/b.spec.json', paramsShape: 'named', hasOutputMapping: false })
  ]);
});
