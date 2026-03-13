import { describe, expect, it } from 'vitest';
import { DynamicQueryBuilder } from '../../src/transformers/DynamicQueryBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

describe('Dynamic filter routing dogfooding', () => {
  it('dogfood: dynamic filters stay on DynamicQueryBuilder when the query already exposes the target columns', () => {
    const builder = new DynamicQueryBuilder();
    const query = builder.buildQuery(`
      SELECT u.id, p.name
      FROM users u
      JOIN profiles p
        ON p.user_id = u.id
      WHERE u.active = true
    `, {
      filter: {
        'profiles.name': 'Alice'
      }
    });

    const { formattedSql, params } = new SqlFormatter().format(query);
    const normalized = normalizeSql(formattedSql);

    expect(normalized).toContain('where "u"."active" = true and "p"."name" = :profiles_name');
    expect(params).toEqual({ profiles_name: 'Alice' });
  });

  it('dogfood: SSSQL covers optional filters that need tables outside the current query graph', () => {
    const builder = new DynamicQueryBuilder();
    const baseSql = `
      SELECT p.product_id, p.product_name
      FROM products p
      WHERE p.active = true
    `;

    expect(() => builder.buildQuery(baseSql, {
      filter: {
        'categories.category_name': 'shoes'
      }
    })).toThrow(/category_name/i);

    const sssqlQuery = builder.buildQuery(`
      SELECT p.product_id, p.product_name
      FROM products p
      WHERE p.active = true
        AND (
          :category_name IS NULL
          OR EXISTS (
            SELECT 1
            FROM product_categories pc
            JOIN categories c
              ON c.category_id = pc.category_id
            WHERE pc.product_id = p.product_id
              AND c.category_name = :category_name
          )
        )
    `, {
      optionalConditionParameters: {
        category_name: null
      }
    });

    const normalized = normalizeSql(new SqlFormatter().format(sssqlQuery).formattedSql);
    expect(normalized).toContain('from "products" as "p"');
    expect(normalized).not.toContain(':category_name');
    expect(normalized).not.toContain('categories');
  });

  it('dogfood: hardcoded predicates stay mandatory while removable SSSQL branches prune on null', () => {
    const builder = new DynamicQueryBuilder();
    const query = builder.buildQuery(`
      SELECT order_id
      FROM orders
      WHERE tenant_id = :tenant_id
        AND (:status IS NULL OR status = :status)
    `, {
      filter: {
        tenant_id: 42
      },
      optionalConditionParameters: {
        status: null
      }
    });

    const { formattedSql, params } = new SqlFormatter().format(query);
    const normalized = normalizeSql(formattedSql);

    expect(normalized).toContain('where "tenant_id" = :tenant_id');
    expect(normalized).not.toContain(':status');
    expect(params).toEqual({ tenant_id: 42 });
  });
});

