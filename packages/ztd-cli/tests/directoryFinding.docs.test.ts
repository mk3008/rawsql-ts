import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readNormalizedFile(relativePath: string): string {
  const filePath = path.join(repoRoot, relativePath);
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

test('readmes promote the query-unit rule without tables/views taxonomy', () => {
  const rootReadme = readNormalizedFile('README.md');
  const scaffoldReadme = readNormalizedFile('packages/ztd-cli/templates/README.md');
  const webapiReadme = readNormalizedFile('packages/ztd-cli/templates/README.webapi.md');

  for (const doc of [rootReadme, scaffoldReadme, webapiReadme]) {
    expect(doc).toContain('1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO');
    expect(doc).toContain('src/sql');
    expect(doc).not.toContain('tables/views');
    expect(doc).not.toContain('lower-level implementation examples');
  }

  expect(rootReadme).toContain('Keep handwritten SQL assets in `src/sql/` as the single human-owned source location for query logic.');
  expect(scaffoldReadme).toContain('Keep handwritten SQL assets in `src/sql/` as the single human-owned source location for query logic.');
  expect(webapiReadme).toContain('Keep handwritten SQL assets in `src/sql/` as the single human-owned source location for query logic.');
  expect(scaffoldReadme).toContain('Think in query units:');
  expect(webapiReadme).toContain('Think in query units:');
  expect(scaffoldReadme).toContain('1 SQL file');
  expect(scaffoldReadme).toContain('1 QuerySpec');
  expect(scaffoldReadme).toContain('1 repository entrypoint');
  expect(scaffoldReadme).toContain('1 DTO');
  expect(webapiReadme).toContain('1 SQL file');
  expect(webapiReadme).toContain('1 QuerySpec');
  expect(webapiReadme).toContain('1 repository entrypoint');
  expect(webapiReadme).toContain('1 DTO');
});

test('repository guidance centers the single SQL source location', () => {
  const files = [
    'packages/ztd-cli/templates/src/repositories/AGENTS.md',
    'packages/ztd-cli/templates/src/infrastructure/persistence/AGENTS.md',
    'packages/ztd-cli/templates/src/infrastructure/persistence/repositories/AGENTS.md'
  ];

  for (const file of files) {
    const contents = readNormalizedFile(file);
    expect(contents).toContain('1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO');
    expect(contents).toContain('src/sql');
    expect(contents).not.toContain('tables/views');
  }

  expect(readNormalizedFile('packages/ztd-cli/templates/src/repositories/AGENTS.md')).toContain(
    'Repositories MUST load SQL assets from `src/sql` through shared loader infrastructure.',
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/infrastructure/persistence/AGENTS.md')).toContain(
    'ZTD-specific workflow rules apply here and in the related `src/sql`, `src/catalog`, and `ztd` assets.',
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/infrastructure/persistence/repositories/AGENTS.md')).toContain(
    'Repositories MUST load SQL assets from `src/sql` through shared loader infrastructure.',
  );
});

test('tables and views folders are absent from the scaffold templates', () => {
  const removedPaths = [
    'packages/ztd-cli/templates/src/repositories/tables',
    'packages/ztd-cli/templates/src/repositories/views',
    'packages/ztd-cli/templates/src/infrastructure/persistence/repositories/tables',
    'packages/ztd-cli/templates/src/infrastructure/persistence/repositories/views'
  ];

  for (const removedPath of removedPaths) {
    expect(existsSync(path.join(repoRoot, removedPath))).toBe(false);
  }
});

test('catalog guidance keeps specs aligned with one query unit', () => {
  const catalogAgents = readNormalizedFile('packages/ztd-cli/templates/src/catalog/AGENTS.md');

  expect(catalogAgents).toContain('Each catalog spec MUST stay aligned with 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.');
  expect(catalogAgents).toContain('`src/catalog/specs` MUST be treated as human-owned contracts.');
  expect(catalogAgents).toContain('tests/queryspec.example.test.ts');
});
