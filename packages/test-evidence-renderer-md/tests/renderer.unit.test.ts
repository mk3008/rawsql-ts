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
    definitionPath?: string;
    fixtures?: string[];
    cases: Array<{ id: string; title: string; input: Record<string, unknown>; output: unknown[] }>;
  }>;
  functionCatalogs?: Array<{
    id: string;
    title: string;
    definitionPath?: string;
    cases: Array<{ id: string; title: string; input: unknown; output: unknown }>;
  }>;
}): PreviewJson {
  return {
    schemaVersion: 1,
    sqlCaseCatalogs: (args.sqlCatalogs ?? []).map((catalog) => ({
      id: catalog.id,
      title: catalog.title,
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
  expect(withFixtures).toContain('#### input');
  expect(withFixtures).toContain('#### output');
  expect(withFixtures).not.toContain('input:');
  expect(withFixtures).not.toContain('output:');
  expect(stableStringify(model)).toBe(modelBefore);
});
