import { expect, test } from 'vitest';
import {
  buildDiffJson,
  buildSpecificationModel,
  stableStringify,
  type DiffJson,
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
    refs?: Array<{ label: string; url: string }>;
    fixtures?: string[];
    cases: Array<{ id: string; title: string; input: Record<string, unknown>; output: unknown[] }>;
  }>;
  functionCatalogs?: Array<{
    id: string;
    title: string;
    description?: string;
    definitionPath?: string;
    refs?: Array<{ label: string; url: string }>;
    cases: Array<{
      id: string;
      title: string;
      input: unknown;
      expected?: 'success' | 'throws' | 'errorResult';
      output?: unknown;
      error?: { name: string; message: string; match: 'equals' | 'contains' };
      tags?: string[];
      focus?: string;
      refs?: Array<{ label: string; url: string }>;
    }>;
  }>;
}): PreviewJson {
  return {
    schemaVersion: 1,
    sqlCaseCatalogs: (args.sqlCatalogs ?? []).map((catalog) => ({
      id: catalog.id,
      title: catalog.title,
      ...(catalog.description ? { description: catalog.description } : {}),
      ...(catalog.definitionPath ? { definitionPath: catalog.definitionPath } : {}),
      ...(Array.isArray(catalog.refs) ? { refs: catalog.refs } : {}),
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
      ...(Array.isArray(catalog.refs) ? { refs: catalog.refs } : {}),
      cases: catalog.cases.map((testCase) => ({
        id: testCase.id,
        title: testCase.title,
        input: testCase.input,
        expected: testCase.expected ?? 'success',
        ...(testCase.expected === 'throws' ? { error: testCase.error } : { output: testCase.output }),
        ...(Array.isArray(testCase.tags) ? { tags: testCase.tags } : {}),
        ...(typeof testCase.focus === 'string' ? { focus: testCase.focus } : {}),
        ...(Array.isArray(testCase.refs) ? { refs: testCase.refs } : {})
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

test('renderDiffReportMarkdown keeps existing case lists when updated catalog overlaps added/removed entries', () => {
  const diff: DiffJson = {
    schemaVersion: 1,
    base: { ref: 'main', sha: 'aaa111' },
    head: { ref: 'HEAD', sha: 'bbb222' },
    baseMode: 'ref',
    totals: {
      base: { catalogs: 1, tests: 1 },
      head: { catalogs: 1, tests: 2 }
    },
    summary: {
      catalogs: { added: 1, removed: 0, updated: 1 },
      cases: { added: 2, removed: 0, updated: 1 }
    },
    catalogs: {
      added: [
        {
          catalogAfter: {
            kind: 'sql',
            catalogId: 'sql.users',
            title: 'users',
            definition: 'src/specs/sql/users.catalog.ts',
            cases: [
              { id: 'added-from-added', title: 'from added', input: {}, expected: 'success', output: [] }
            ]
          }
        }
      ],
      removed: [],
      updated: [
        {
          catalogId: 'sql.users',
          catalogBefore: {
            kind: 'sql',
            catalogId: 'sql.users',
            title: 'users',
            definition: 'src/specs/sql/users.catalog.ts',
            cases: [{ id: 'baseline', title: 'baseline', input: {}, expected: 'success', output: [] }]
          },
          catalogAfter: {
            kind: 'sql',
            catalogId: 'sql.users',
            title: 'users',
            definition: 'src/specs/sql/users.catalog.ts',
            cases: [
              { id: 'baseline', title: 'baseline', input: {}, expected: 'success', output: [{ id: 1 }] },
              { id: 'added-from-updated', title: 'from updated', input: {}, expected: 'success', output: [] }
            ]
          },
          cases: {
            added: [{ after: { id: 'added-from-updated', title: 'from updated', input: {}, expected: 'success', output: [] } }],
            removed: [],
            updated: [
              {
                before: { id: 'baseline', title: 'baseline', input: {}, expected: 'success', output: [] },
                after: { id: 'baseline', title: 'baseline', input: {}, expected: 'success', output: [{ id: 1 }] }
              }
            ]
          }
        }
      ]
    }
  };
  const markdown = renderDiffReportMarkdown(diff, { generatedAt: '2026-02-22T00:00:00.000Z' });

  expect(markdown).toContain('- catalogId: sql.users');
  expect(markdown).toContain('  - cases.added: added-from-added, added-from-updated');
  expect(markdown).toContain('  - cases.updated: baseline');
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
  expect(withFixtures).toContain('# sql.users Test Cases');
  expect(withFixtures).toContain('User SQL catalog summary.');
  expect(withFixtures).not.toContain('- kind: sql');
  expect(withFixtures).toContain('## baseline - baseline');
  expect(withFixtures).toContain('- expected: success');
  expect(withFixtures).toContain('### input');
  expect(withFixtures).toContain('### output');
  expect(stableStringify(model)).toBe(modelBefore);
});

test('renderSpecificationMarkdown renders throws cases with error and never output', () => {
  const preview = createPreview({
    functionCatalogs: [
      {
        id: 'unit.normalize-email',
        title: 'normalizeEmail',
        refs: [{ label: 'Issue #448', url: 'https://github.com/mk3008/rawsql-ts/issues/448' }],
        cases: [
          {
            id: 'rejects-invalid-input',
            title: 'throws when @ is missing',
            input: 'invalid-email',
            expected: 'throws',
            error: { name: 'Error', message: 'invalid email', match: 'contains' },
            tags: ['validation', 'ep'],
            focus: 'Rejects missing at-sign.',
            refs: [{ label: 'Case Ref', url: 'https://github.com/mk3008/rawsql-ts/issues/999' }]
          },
          {
            id: 'trims-and-lowercases',
            title: 'normalizes uppercase + spaces',
            input: '  USER@Example.COM ',
            expected: 'success',
            output: 'user@example.com'
          }
        ]
      }
    ]
  });
  const model = buildSpecificationModel(preview);
  const markdown = renderSpecificationMarkdown(model);

  expect(markdown).toContain('## rejects-invalid-input - throws when @ is missing');
  expect(markdown).toContain('- expected: throws');
  expect(markdown).toContain('- tags: [validation, ep]');
  expect(markdown).toContain('- focus: Rejects missing at-sign.');
  expect(markdown).toContain('- refs:');
  expect(markdown).toContain('- [Issue #448](https://github.com/mk3008/rawsql-ts/issues/448)');
  expect(markdown).toContain('- [Case Ref](https://github.com/mk3008/rawsql-ts/issues/999)');
  expect(markdown).toContain('### error');
  expect(markdown).not.toContain('## rejects-invalid-input - throws when @ is missing\n- expected: throws\n### input\n```json\n"invalid-email"\n```\n### output');
  expect(markdown).toContain('{\n  "name": "Error",\n  "message": "invalid email",\n  "match": "contains"\n}');
  expect(markdown).toContain('## trims-and-lowercases - normalizes uppercase + spaces');
  expect(markdown).toContain('- expected: success');
});

test('renderSpecificationMarkdown keeps case ordering stable by id', () => {
  const preview = createPreview({
    functionCatalogs: [
      {
        id: 'unit.ordering',
        title: 'ordering',
        cases: [
          {
            id: 'z-last',
            title: 'z',
            input: { b: 1, a: 2 },
            output: { b: 1, a: 2 },
            tags: ['invariant', 'state'],
            focus: 'Ensures z ordering case remains deterministic.'
          },
          {
            id: 'a-first',
            title: 'a',
            input: { y: 1, x: 2 },
            output: { y: 1, x: 2 },
            tags: ['invariant', 'state'],
            focus: 'Ensures a ordering case remains deterministic.'
          }
        ]
      }
    ]
  });
  const model = buildSpecificationModel(preview);
  const markdown = renderSpecificationMarkdown(model);
  expect(markdown).toMatchSnapshot();
  expect(markdown.indexOf('## a-first - a')).toBeLessThan(markdown.indexOf('## z-last - z'));
  expect(markdown).toContain('{\n  "x": 2,\n  "y": 1\n}');
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
