import { expect, test } from 'vitest';
import {
  buildDiffJson,
  buildSpecificationModel,
  stableStringify,
  type PreviewJson
} from '@rawsql-ts/test-evidence-core';
import {
  renderDiffMarkdown,
  renderLegacyDiffMarkdown,
  renderDiffReportMarkdown,
  renderSpecificationMarkdown
} from '../src';

function createPreview(args: {
  sqlCatalogs?: Array<{
    id: string;
    title: string;
    description?: string;
    definitionPath?: string;
    fixtures?: string[];
    cases: Array<{ id: string; title: string; input: Record<string, unknown>; output: unknown[] }>;
  }>;
  functionCatalogs?: Array<{
    id: string;
    title: string;
    description?: string;
    definitionPath?: string;
    cases: Array<{ id: string; title: string; input: unknown; output: unknown }>;
  }>;
}): PreviewJson {
  return {
    schemaVersion: 1,
    sqlCaseCatalogs: (args.sqlCatalogs ?? []).map((catalog) => ({
      id: catalog.id,
      title: catalog.title,
      ...(catalog.description ? { description: catalog.description } : {}),
      ...(catalog.definitionPath ? { definitionPath: catalog.definitionPath } : {}),
      fixtures: (catalog.fixtures ?? []).map((tableName) => ({ tableName })),
      cases: catalog.cases.map((testCase) => ({
        id: testCase.id,
        title: testCase.title,
        params: testCase.input,
        expected: testCase.output
      }))
    })),
    testCaseCatalogs: (args.functionCatalogs ?? []).map((catalog) => ({
      id: catalog.id,
      title: catalog.title,
      ...(catalog.description ? { description: catalog.description } : {}),
      ...(catalog.definitionPath ? { definitionPath: catalog.definitionPath } : {}),
      cases: catalog.cases.map((testCase) => ({
        id: testCase.id,
        title: testCase.title,
        input: testCase.input,
        output: testCase.output
      }))
    }))
  };
}

test('renderDiffMarkdown renders test-centric projection only', () => {
  const base = createPreview({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        definitionPath: 'src/specs/sql/users.ts',
        fixtures: ['users'],
        cases: [{ id: 'baseline', title: 'baseline', input: { active: 1 }, output: [{ id: 1 }] }]
      }
    ]
  });
  const head = createPreview({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        definitionPath: 'src/specs/sql/users.ts',
        fixtures: ['users'],
        cases: [
          { id: 'baseline', title: 'baseline', input: { active: 0 }, output: [{ id: 2 }] },
          { id: 'added-case', title: 'added', input: { active: 2 }, output: [{ id: 3 }] }
        ]
      }
    ]
  });

  const diff = buildDiffJson({
    base: { ref: 'main', sha: 'a', previewJson: base },
    head: { ref: 'HEAD', sha: 'b', previewJson: head },
    baseMode: 'ref'
  });

  const before = stableStringify(diff);
  const markdown = renderDiffMarkdown(diff);
  expect(markdown).toContain('## sql.users - users');
  expect(markdown).toContain('### ADD: added-case - added');
  expect(markdown).toContain('### UPDATE: baseline - baseline');
  expect(stableStringify(diff)).toBe(before);
});

test('legacy removed detail option only changes presentation', () => {
  const base = createPreview({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        cases: [{ id: 'removed-case', title: 'removed', input: { active: 9 }, output: [{ id: 9 }] }]
      }
    ]
  });
  const head = createPreview({});

  const diff = buildDiffJson({
    base: { ref: 'main', sha: 'a', previewJson: base },
    head: { ref: 'HEAD', sha: 'b', previewJson: head },
    baseMode: 'ref'
  });

  const before = stableStringify(diff);
  const markdownNone = renderLegacyDiffMarkdown(diff, { removedDetail: 'none' });
  const markdownFull = renderLegacyDiffMarkdown(diff, { removedDetail: 'full' });
  expect(markdownNone).not.toContain('output:');
  expect(markdownFull).toContain('output:');
  expect(stableStringify(diff)).toBe(before);
});

test('renderDiffReportMarkdown prints deterministic summary projection', () => {
  const diff = buildDiffJson({
    base: { ref: 'main', sha: 'aaa111', previewJson: createPreview({}) },
    head: { ref: 'HEAD', sha: 'bbb222', previewJson: createPreview({}) },
    baseMode: 'merge-base'
  });
  const markdown = renderDiffReportMarkdown(diff, {
    generatedAt: '2026-02-21T00:00:00.000Z',
    unsupportedSchemaValidation: { checked: true, passed: true }
  });
  expect(markdown).toContain('- generatedAt: 2026-02-21T00:00:00.000Z');
  expect(markdown).toContain('- schemaVersion: 1');
  expect(markdown).toContain('- deterministicUnsupportedSchemaErrorPresent: yes');
});

test('renderSpecificationMarkdown options change presentation only', () => {
  const preview = createPreview({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        description: 'User SQL catalog summary.',
        fixtures: ['users', 'orders'],
        cases: [{ id: 'baseline', title: 'baseline', input: { active: 1 }, output: [{ id: 1 }] }]
      }
    ]
  });
  const model = buildSpecificationModel(preview);
  const modelBefore = stableStringify(model);
  const withoutFixtures = renderSpecificationMarkdown(model, { includeFixtures: false });
  const withFixtures = renderSpecificationMarkdown(model, { includeFixtures: true });

  expect(withoutFixtures).not.toContain('- fixtures: orders, users');
  expect(withFixtures).toContain('- fixtures: orders, users');
  expect(withFixtures).toContain('## sql.users - users');
  expect(withFixtures).toContain('User SQL catalog summary.');
  expect(withFixtures).not.toContain('- kind: sql');
  expect(withFixtures).toContain('### baseline - baseline');
  expect(withFixtures).toContain('#### input');
  expect(withFixtures).toContain('#### output');
  expect(stableStringify(model)).toBe(modelBefore);
});

test('definition link rendering supports path and github modes', () => {
  const preview = createPreview({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        definitionPath: 'src/specs/sql/users.catalog.ts',
        cases: [{ id: 'baseline', title: 'baseline', input: { active: 1 }, output: [{ id: 1 }] }]
      }
    ]
  });
  const model = buildSpecificationModel(preview);
  const diff = buildDiffJson({
    base: { ref: 'main', sha: 'aaa', previewJson: preview },
    head: {
      ref: 'HEAD',
      sha: 'bbb',
      previewJson: createPreview({
        sqlCatalogs: [
          {
            id: 'sql.users',
            title: 'users',
            definitionPath: 'src/specs/sql/users.catalog.ts',
            cases: [{ id: 'baseline', title: 'baseline', input: { active: 0 }, output: [{ id: 2 }] }]
          }
        ]
      })
    },
    baseMode: 'ref'
  });

  const specPath = renderSpecificationMarkdown(model, { definitionLinks: { mode: 'path' } });
  const specGithub = renderSpecificationMarkdown(model, {
    definitionLinks: {
      mode: 'github',
      github: {
        serverUrl: 'https://github.com',
        repository: 'mk3008/rawsql-ts',
        ref: 'abc123'
      }
    }
  });
  const diffPath = renderDiffMarkdown(diff, { definitionLinks: { mode: 'path' } });
  const diffGithub = renderDiffMarkdown(diff, {
    definitionLinks: {
      mode: 'github',
      github: {
        serverUrl: 'https://github.com',
        repository: 'mk3008/rawsql-ts',
        ref: 'abc123'
      }
    }
  });

  expect(specPath).toContain('- definition: [src/specs/sql/users.catalog.ts](src/specs/sql/users.catalog.ts)');
  expect(specGithub).toContain(
    '- definition: [src/specs/sql/users.catalog.ts](https://github.com/mk3008/rawsql-ts/blob/abc123/src/specs/sql/users.catalog.ts)'
  );
  expect(diffPath).toContain('[File](src/specs/sql/users.catalog.ts)');
  expect(diffGithub).toContain(
    '[File](https://github.com/mk3008/rawsql-ts/blob/abc123/src/specs/sql/users.catalog.ts)'
  );
});
