import { describe, expect, it } from 'vitest';
import { DynamicQueryBuilder } from '../../src/transformers/DynamicQueryBuilder';
import { SSSQLFilterBuilder } from '../../src/transformers/SSSQLFilterBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

describe('Dynamic filter routing dogfooding', () => {
  it('dogfood: runtime DynamicQueryBuilder no longer injects new filter predicates', () => {
    const builder = new DynamicQueryBuilder();

    expect(() => builder.buildQuery(`
      SELECT u.id, p.name
      FROM users u
      JOIN profiles p
        ON p.user_id = u.id
      WHERE u.active = true
    `, {
      filter: {
        'profiles.name': 'Alice'
      }
    })).toThrow(/ztd query sssql scaffold/i);
  });

  it('dogfood: SSSQL scaffold owns optional filter authoring before runtime pruning', () => {
    const scaffoldBuilder = new SSSQLFilterBuilder();
    const runtimeBuilder = new DynamicQueryBuilder();
    const baseSql = `
      SELECT p.product_id, p.product_name
      FROM products p
      WHERE p.active = true
    `;

    const scaffolded = scaffoldBuilder.scaffold(baseSql, {
      'products.product_name': 'shoe'
    });

    const query = runtimeBuilder.buildQuery(new SqlFormatter().format(scaffolded).formattedSql, {
      optionalConditionParameters: {
        products_product_name: null
      }
    });

    const normalized = normalizeSql(new SqlFormatter().format(query).formattedSql);
    expect(normalized).toContain('from "products" as "p"');
    expect(normalized).not.toContain(':products_product_name');
    expect(normalized).not.toContain('is null or "p"."product_name" = :products_product_name');
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

