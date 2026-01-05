import { describe, expect, it } from 'vitest';
import { DefaultFixtureProvider } from '../src/fixtures/FixtureProvider';
import { TableNameResolver } from '../src/fixtures/TableNameResolver';
import { ResultSelectRewriter } from '../src/rewriter/ResultSelectRewriter';
import type { TableDefinitionModel, TableRowsFixture } from '../src/types';

const tableDefinitions: TableDefinitionModel[] = [
  {
    name: 'public.category',
    columns: [
      { name: 'category_id', typeName: 'INTEGER' },
      { name: 'parent_id', typeName: 'INTEGER' },
      { name: 'name', typeName: 'TEXT' },
    ],
  },
];

const baseRows: TableRowsFixture[] = [
  {
    tableName: 'public.category',
    rows: [
      { category_id: 1, parent_id: null, name: 'Root' },
      { category_id: 2, parent_id: 1, name: 'Child' },
    ],
  },
];

describe('ResultSelectRewriter', () => {
  it('rewrites every occurrence of the same table in joins', () => {
    const resolver = new TableNameResolver({ defaultSchema: 'public' });
    const fixtures = new DefaultFixtureProvider(
      tableDefinitions,
      baseRows,
      resolver
    );
    const rewriter = new ResultSelectRewriter(
      fixtures,
      'error',
      undefined,
      resolver
    );

    const sql = `
      select
        c.category_id as "categoryId",
        c.parent_id as "parentId",
        p.name as "parentName",
        c.name as "name"
      from
        public.category c
        left join public.category p on c.parent_id = p.category_id
      order by
        c.category_id;
    `;
    const result = rewriter.rewrite(sql);
    const normalized = result.sql.toLowerCase();

    expect(normalized).not.toContain('public.category');
    expect(normalized).toContain('public_category');
  });
});
