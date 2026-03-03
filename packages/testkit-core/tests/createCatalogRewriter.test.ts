import { describe, expect, test } from 'vitest';
import { createCatalogRewriter } from '../src/catalog/createCatalogRewriter';

describe('createCatalogRewriter', () => {
  test('returns a catalog-compatible rewriter that preserves params', () => {
    const rewriter = createCatalogRewriter({
      name: 'catalog-fixture',
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice' }],
          schema: {
            columns: {
              id: 'INTEGER',
              name: 'TEXT',
            },
          },
        },
      ],
    });
    const params = [1];

    const result = rewriter.rewrite({
      specId: 'demo.user.by-id',
      spec: { id: 'demo.user.by-id' },
      sql: 'SELECT id, name FROM users WHERE id = ?',
      params,
    });

    expect(rewriter.name).toBe('catalog-fixture');
    expect(result.params).toBe(params);
    expect(result.sql.toLowerCase()).toContain('with "users" as');
    expect(result.sql).toContain("'Alice'");
    expect(result.sql.toLowerCase()).toContain('where "id"');
  });

  test('uses catalog execution options as rewrite context overrides', () => {
    const rewriter = createCatalogRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice' }],
          schema: {
            columns: {
              id: 'INTEGER',
              name: 'TEXT',
            },
          },
        },
      ],
    });

    const result = rewriter.rewrite({
      specId: 'demo.user.override',
      spec: { id: 'demo.user.override' },
      sql: 'SELECT id, name FROM users',
      params: [],
      options: {
        fixtures: [
          {
            tableName: 'users',
            rows: [{ id: 2, name: 'Bob' }],
            schema: {
              columns: {
                id: 'INTEGER',
                name: 'TEXT',
              },
            },
          },
        ],
      },
    });

    expect(result.sql).toContain("'Bob'");
    expect(result.sql).not.toContain("'Alice'");
  });
});
