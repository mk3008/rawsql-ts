import { expect, test } from 'vitest';
import { buildDiffJson, renderDiffMarkdown, renderLegacyDiffMarkdown, type PreviewJson } from '../src';

function createPreview(args: {
  sqlCatalogs?: Array<{
    id: string;
    title: string;
    definitionPath?: string;
    fixtures?: string[];
    cases: Array<{ id: string; title: string; input: Record<string, unknown>; output: unknown[] }>;
  }>;
}): PreviewJson {
  const sqlCatalogs = args.sqlCatalogs ?? [];

  return {
    schemaVersion: 1,
    sqlCaseCatalogs: sqlCatalogs.map((catalog) => ({
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
    testCaseCatalogs: []
  };
}

function createDiffFixture() {
  const base = createPreview({
    sqlCatalogs: [
      {
        id: 'sql.users',
        title: 'users',
        definitionPath: 'src/specs/sql/users.ts',
        fixtures: ['users'],
        cases: [
          { id: 'baseline', title: 'baseline', input: { active: 1 }, output: [{ id: 1 }] },
          { id: 'removed-case', title: 'removed', input: { active: 9 }, output: [{ id: 9 }] }
        ]
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
  return diff;
}

test('renderLegacyDiffMarkdown matches legacy ztd-cli output exactly', () => {
  const diff = createDiffFixture();
  const markdown = renderLegacyDiffMarkdown(diff, { removedDetail: 'input' });
  expect(markdown).toMatchSnapshot();
});

test('renderDiffMarkdown emits test-centric markdown', () => {
  const diff = createDiffFixture();
  const markdown = renderDiffMarkdown(diff);
  expect(markdown).toMatchSnapshot();
});
