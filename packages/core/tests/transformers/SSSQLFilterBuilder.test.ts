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

    it('scaffolds operator-based branches idempotently and normalizes != to <>', () => {
        const builder = new SSSQLFilterBuilder();
        const once = builder.scaffoldBranch(
            `
                SELECT p.product_id, p.brand_name
                FROM products p
            `,
            {
                target: 'products.brand_name',
                parameterName: 'brand_name',
                operator: '!='
            }
        );

        const twice = builder.scaffoldBranch(once, {
            target: 'products.brand_name',
            parameterName: 'brand_name',
            operator: '<>'
        });

        const normalized = normalizeSql(new SqlFormatter().format(twice).formattedSql);
        expect(normalized).toContain('(:brand_name is null or "p"."brand_name" <> :brand_name)');
        expect(normalized.match(/:brand_name is null or "p"\."brand_name" <> :brand_name/g)?.length).toBe(1);
    });

    it('scaffolds exists and not-exists branches from explicit subquery input', () => {
        const builder = new SSSQLFilterBuilder();
        const existsQuery = builder.scaffoldBranch(
            `
                SELECT p.product_id, p.product_name
                FROM products p
            `,
            {
                kind: 'exists',
                parameterName: 'category_name',
                anchorColumns: ['products.product_id'],
                query: `
                    SELECT 1
                    FROM product_categories pc
                    JOIN categories c
                      ON c.category_id = pc.category_id
                    WHERE pc.product_id = $c0
                      AND c.category_name = :category_name
                `
            }
        );

        const notExistsQuery = builder.scaffoldBranch(existsQuery, {
            kind: 'not-exists',
            parameterName: 'archived_name',
            anchorColumns: ['products.product_id'],
            query: `
                SELECT 1
                FROM archived_products ap
                WHERE ap.product_id = $c0
                  AND ap.product_name = :archived_name
            `
        });

        const normalized = normalizeSql(new SqlFormatter().format(notExistsQuery).formattedSql);
        expect(normalized).toContain(':category_name is null or exists');
        expect(normalized).toContain('"pc"."product_id" = "p"."product_id"');
        expect(normalized).toContain(':archived_name is null or not exists');
    });

    it('lists supported branch metadata and removes a targeted branch idempotently', () => {
        const builder = new SSSQLFilterBuilder();
        const scaffolded = builder.scaffoldBranch(
            `
                SELECT p.product_id, p.product_name
                FROM products p
            `,
            {
                target: 'products.product_name',
                parameterName: 'product_name',
                operator: 'ilike'
            }
        );

        const withExists = builder.scaffoldBranch(scaffolded, {
            kind: 'exists',
            parameterName: 'category_name',
            anchorColumns: ['products.product_id'],
            query: `
                SELECT 1
                FROM product_categories pc
                WHERE pc.product_id = $c0
                  AND pc.category_name = :category_name
            `
        });

        const listed = builder.list(withExists);
        expect(listed).toEqual(expect.arrayContaining([
            expect.objectContaining({
                parameterName: 'product_name',
                kind: 'scalar',
                operator: 'ilike',
                target: 'p.product_name'
            }),
            expect.objectContaining({
                parameterName: 'category_name',
                kind: 'exists'
            })
        ]));

        const removed = builder.remove(withExists, { parameterName: 'category_name', kind: 'exists' });
        const normalized = normalizeSql(new SqlFormatter().format(removed).formattedSql);
        expect(normalized).not.toContain(':category_name');
        expect(normalized).toContain(':product_name is null or "p"."product_name" ilike :product_name');

        const removedAgain = builder.remove(removed, { parameterName: 'category_name', kind: 'exists' });
        expect(normalizeSql(new SqlFormatter().format(removedAgain).formattedSql)).toBe(normalized);
    });

    it('removes all recognized branches in one call', () => {
        const builder = new SSSQLFilterBuilder();
        const scaffolded = builder.scaffoldBranch(
            `
                SELECT p.product_id, p.product_name
                FROM products p
            `,
            {
                target: 'products.product_name',
                parameterName: 'product_name',
                operator: 'ilike'
            }
        );

        const withExists = builder.scaffoldBranch(scaffolded, {
            kind: 'exists',
            parameterName: 'category_name',
            anchorColumns: ['products.product_id'],
            query: `
                SELECT 1
                FROM product_categories pc
                WHERE pc.product_id = $c0
                  AND pc.category_name = :category_name
            `
        });

        const removed = builder.removeAll(withExists);
        const normalized = normalizeSql(new SqlFormatter().format(removed).formattedSql);
        expect(normalized).toBe('select "p"."product_id", "p"."product_name" from "products" as "p"');
    });

});
