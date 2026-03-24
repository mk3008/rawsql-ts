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

  it('avoids alias collisions for schema-qualified fixtures', () => {
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
      WITH public_category AS (SELECT 1 AS category_id)
      SELECT c.category_id
      FROM public.category c
    `;
    const result = rewriter.rewrite(sql);

    expect(result.sql.toLowerCase()).toContain('with "public__category" as');
    expect(result.sql).toContain('from "public__category" as "c"');
  });

  it('rewrites unqualified queries against schema-qualified DDL fixtures', () => {
    const resolver = new TableNameResolver({ defaultSchema: 'public' });
    const fixtures = new DefaultFixtureProvider(
      [
        {
          name: 'public.users',
          columns: [
            { name: 'id', typeName: 'INTEGER' },
            { name: 'email', typeName: 'TEXT' },
          ],
        },
      ],
      [
        {
          tableName: 'public.users',
          rows: [{ id: 1, email: 'alice@example.com' }],
        },
      ],
      resolver
    );
    const rewriter = new ResultSelectRewriter(
      fixtures,
      'error',
      undefined,
      resolver
    );

    const result = rewriter.rewrite('select id, email from users where id = 1');

    expect(result.sql.toLowerCase()).toContain('with "public_users" as');
    expect(result.sql).toContain('from "public_users"');
    expect(result.fixturesApplied).toEqual(['public.users']);
  });
});
