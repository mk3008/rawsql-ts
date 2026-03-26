import { describe, expect, it } from 'vitest';
import { SSSQLFilterBuilder } from '../../src/transformers/SSSQLFilterBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

describe('SSSQLFilterBuilder', () => {
    it('scaffolds an equality-based optional filter into a simple query', () => {
        const builder = new SSSQLFilterBuilder();
        const query = builder.scaffold(
            `
                SELECT u.id, u.name
                FROM users u
                WHERE u.active = true
            `,
            { 'users.name': 'Alice' }
        );

        const normalized = normalizeSql(new SqlFormatter().format(query).formattedSql);
        expect(normalized).toContain('where "u"."active" = true and (:users_name is null or "u"."name" = :users_name)');
    });

    it('rejects ambiguous unqualified scaffold targets', () => {
        const builder = new SSSQLFilterBuilder();

        expect(() => builder.scaffold(
            `
                SELECT u.name, p.name
                FROM users u
                JOIN profiles p ON p.user_id = u.id
            `,
            { name: 'Alice' }
        )).toThrow(/ambiguous/i);
    });

    it('rejects non-equality scaffold filters in v1', () => {
        const builder = new SSSQLFilterBuilder();

        expect(() => builder.scaffold(
            `
                SELECT p.product_id, p.brand_name
                FROM products p
            `,
            { brand_name: { like: 'Acme%' } as unknown }
        )).toThrow(/only supports equality/i);
    });

    it('refresh moves an existing optional branch without changing its predicate shape', () => {
        const builder = new SSSQLFilterBuilder();
        const refreshed = builder.refresh(
            `
                WITH base_orders AS (
                    SELECT o.order_id, o.status
                    FROM orders o
                )
                SELECT b.order_id
                FROM base_orders b
                WHERE (:orders_status IS NULL OR lower(b.status) LIKE lower(:orders_status))
            `,
            { 'orders.status': { '=': 'paid' } }
        );

        const normalized = normalizeSql(new SqlFormatter().format(refreshed).formattedSql);
        expect(normalized).toContain('with "base_orders" as (select "o"."order_id", "o"."status" from "orders" as "o" where (:orders_status is null or lower("o"."status") like lower(:orders_status)))');
        expect(normalized).toContain('select "b"."order_id" from "base_orders" as "b"');
    });

    it('scaffolds a new branch during refresh when none exists yet', () => {
        const builder = new SSSQLFilterBuilder();
        const refreshed = builder.refresh(
            `
                SELECT p.product_id, p.product_name
                FROM products p
                WHERE p.active = true
            `,
            { 'products.product_name': 'shoe' }
        );

        const normalized = normalizeSql(new SqlFormatter().format(refreshed).formattedSql);
        expect(normalized).toContain('where "p"."active" = true and (:products_product_name is null or "p"."product_name" = :products_product_name)');
    });
});
