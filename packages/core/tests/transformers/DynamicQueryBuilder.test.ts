import { beforeEach, describe, expect, it } from 'vitest';
import { DynamicQueryBuilder } from '../../src/transformers/DynamicQueryBuilder';
import { SchemaInfo } from '../../src/transformers/OptimizeUnusedLeftJoins';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('DynamicQueryBuilder', () => {
    const schemaInfo: SchemaInfo = [
        { name: 'profiles', columns: ['id', 'user_id'], uniqueKeys: [['id']] },
        { name: 'settings', columns: ['id', 'profile_id'], uniqueKeys: [['profile_id']] }
    ];
    let builder: DynamicQueryBuilder;

    beforeEach(() => {
        builder = new DynamicQueryBuilder();
    });

    describe('runtime responsibilities after issue #632', () => {
        it('preserves SQL when no runtime modifications are requested', () => {
            const sql = 'SELECT id, name FROM users WHERE active = true';

            const result = builder.buildQuery(sql);

            const { formattedSql } = new SqlFormatter().format(result);
            expect(formattedSql).toContain('from "users"');
            expect(formattedSql).toContain('where "active" = true');
        });

        it('fails fast when a runtime filter would add a new predicate', () => {
            expect(() =>
                builder.buildQuery('SELECT id, name FROM users WHERE active = true', {
                    filter: { name: 'Alice' }
                })
            ).toThrow(/ztd query sssql scaffold/i);
            expect(() =>
                builder.buildQuery('SELECT id, name FROM users WHERE active = true', {
                    filter: { name: 'Alice' }
                })
            ).toThrow(/ztd query sssql refresh/i);
        });

        it('still binds existing named parameters through the filter option', () => {
            const result = builder.buildQuery(
                'SELECT order_id FROM orders WHERE tenant_id = :tenant_id AND status = :status',
                {
                    filter: {
                        tenant_id: 42,
                        status: 'paid'
                    }
                }
            );

            const { formattedSql, params } = new SqlFormatter().format(result);
            expect(formattedSql).toContain('"tenant_id" = :tenant_id');
            expect(formattedSql).toContain('"status" = :status');
            expect(params).toEqual({ tenant_id: 42, status: 'paid' });
        });

        it('keeps sort and paging as runtime responsibilities', () => {
            const result = builder.buildQuery(
                'SELECT id, name FROM users WHERE active = true',
                {
                    sort: { name: { desc: true } },
                    paging: { page: 2, pageSize: 10 }
                }
            );

            const { formattedSql, params } = new SqlFormatter().format(result);
            expect(formattedSql).toContain('order by "name" desc');
            expect(formattedSql).toContain('limit :paging_limit');
            expect(formattedSql).toContain('offset :paging_offset');
            expect(params).toEqual({ paging_limit: 10, paging_offset: 10 });
        });

        it('uses buildFilteredQuery as the same fail-fast path', () => {
            expect(() =>
                builder.buildFilteredQuery('SELECT id FROM users', { name: 'Alice' })
            ).toThrow(/ztd query sssql scaffold/i);
        });
    });

    describe('column and pruning helpers', () => {
        it('applies column projection filters without changing order', () => {
            const result = builder.buildQuery(
                'SELECT id, name, email FROM users WHERE active = true',
                { excludeColumns: ['email'] }
            );

            const { formattedSql } = new SqlFormatter().format(result);
            expect(formattedSql).toContain('"id"');
            expect(formattedSql).toContain('"name"');
            expect(formattedSql).not.toContain('"email"');
        });

        it('prunes optional SSSQL branches while preserving mandatory placeholders', () => {
            const result = builder.buildQuery(
                `
                    SELECT order_id
                    FROM orders
                    WHERE tenant_id = :tenant_id
                      AND (:status IS NULL OR lower(status) LIKE lower(:status))
                `,
                {
                    filter: { tenant_id: 42 },
                    optionalConditionParameters: { status: null }
                }
            );

            const { formattedSql, params } = new SqlFormatter().format(result);
            expect(formattedSql).toContain('"tenant_id" = :tenant_id');
            expect(formattedSql).not.toContain(':status');
            expect(params).toEqual({ tenant_id: 42 });
        });

        it('keeps supported optional branches intact when the parameter is present', () => {
            const result = builder.buildQuery(
                `
                    SELECT order_id
                    FROM orders
                    WHERE (:status IS NULL OR lower(status) LIKE lower(:status))
                `,
                {
                    optionalConditionParameters: { status: 'paid%' }
                }
            );

            const { formattedSql } = new SqlFormatter().format(result);
            expect(formattedSql).toContain('lower("status") like lower(:status)');
        });
    });

    describe('remaining builder responsibilities', () => {
        it('applies JSON serialization after runtime pruning and paging', () => {
            const result = builder.buildQuery(
                `
                    SELECT p.product_id AS id, p.brand_name
                    FROM products p
                    WHERE (:brand_name IS NULL OR p.brand_name = :brand_name)
                `,
                {
                    optionalConditionParameters: { brand_name: null },
                    paging: { page: 1, pageSize: 5 },
                    serialize: {
                        rootName: 'product',
                        rootEntity: {
                            id: 'product',
                            name: 'Product',
                            columns: { id: 'id', brand_name: 'brand_name' }
                        },
                        nestedEntities: []
                    }
                }
            );

            const { formattedSql } = new SqlFormatter().format(result);
            expect(formattedSql).toContain('jsonb_agg');
            expect(formattedSql).toContain('limit :paging_limit');
        });

        it('removes unused left joins when schema metadata is provided', () => {
            const result = builder.buildQuery(
                `
                    SELECT u.id
                    FROM users u
                    LEFT JOIN profiles p ON p.id = u.profile_id
                `,
                {
                    removeUnusedLeftJoins: true,
                    schemaInfo
                }
            );

            const { formattedSql } = new SqlFormatter().format(result);
            expect(formattedSql).not.toContain('left join "profiles"');
        });

        it('removes unused CTEs when requested', () => {
            const result = builder.buildQuery(
                `
                    WITH unused_cte AS (
                        SELECT id FROM users
                    ),
                    active_users AS (
                        SELECT id FROM users WHERE active = true
                    )
                    SELECT * FROM active_users
                `,
                {
                    removeUnusedCtes: true
                }
            );

            const { formattedSql } = new SqlFormatter().format(result);
            expect(formattedSql).toMatch(/\bactive_users\b/i);
            expect(formattedSql).not.toMatch(/\bunused_cte\b/i);
        });
    });
});
