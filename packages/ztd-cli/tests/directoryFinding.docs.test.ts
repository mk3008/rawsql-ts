import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readNormalizedFile(relativePath: string): string {
  const filePath = path.join(repoRoot, relativePath);
  return readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

test('readmes promote the query-unit rule', () => {
  const rootReadme = readNormalizedFile('README.md');
  const scaffoldReadme = readNormalizedFile('packages/ztd-cli/templates/README.md');
  const webapiReadme = readNormalizedFile('packages/ztd-cli/templates/README.webapi.md');

  for (const doc of [rootReadme, scaffoldReadme, webapiReadme]) {
    expect(doc).toContain('1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO');
  }

  expect(rootReadme).toContain('Procedure: `DDL -> SQL -> generate -> wire -> test`.');
  expect(scaffoldReadme).toContain('Think in query units: 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.');
  expect(scaffoldReadme).toContain('Treat `tables/` and `views/` as lower-level implementation examples under that rule.');
  expect(webapiReadme).toContain('Think in query units: 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.');
  expect(webapiReadme).toContain('Treat `tables/` and `views/` as lower-level implementation examples under that rule.');
});

test('repository guidance keeps tables and views subordinate to the query-unit rule', () => {
  const files = [
    'packages/ztd-cli/templates/src/repositories/AGENTS.md',
    'packages/ztd-cli/templates/src/repositories/tables/AGENTS.md',
    'packages/ztd-cli/templates/src/repositories/views/AGENTS.md',
    'packages/ztd-cli/templates/src/infrastructure/persistence/AGENTS.md',
    'packages/ztd-cli/templates/src/infrastructure/persistence/repositories/AGENTS.md',
    'packages/ztd-cli/templates/src/infrastructure/persistence/repositories/tables/AGENTS.md',
    'packages/ztd-cli/templates/src/infrastructure/persistence/repositories/views/AGENTS.md',
  ];

  for (const file of files) {
    const contents = readNormalizedFile(file);
    expect(contents).toContain('1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO');
  }

  expect(readNormalizedFile('packages/ztd-cli/templates/src/repositories/AGENTS.md')).toContain(
    'lower-level implementation examples under the query-unit policy',
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/repositories/tables/AGENTS.md')).toContain(
    'lower-level table example for query units that mutate data',
  );
  expect(readNormalizedFile('packages/ztd-cli/templates/src/repositories/views/AGENTS.md')).toContain(
    'lower-level view example for query units that stay read-only',
  );
});

test('catalog guidance keeps specs aligned with one query unit', () => {
  const catalogAgents = readNormalizedFile('packages/ztd-cli/templates/src/catalog/AGENTS.md');

  expect(catalogAgents).toContain('Each catalog spec MUST stay aligned with 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.');
  expect(catalogAgents).toContain('`src/catalog/specs` MUST be treated as human-owned contracts.');
  expect(catalogAgents).toContain('tests/queryspec.example.test.ts');
});
