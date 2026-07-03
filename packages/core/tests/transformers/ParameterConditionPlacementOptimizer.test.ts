import { describe, expect, it } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import {
    optimizeParameterConditionPlacement,
    planParameterConditionOptimization
} from '../../src/transformers/ParameterConditionPlacementOptimizer';

const normalizeSql = (sql: string): string => {
    const query = SelectQueryParser.parse(sql);
    return new SqlFormatter().format(query).formattedSql;
};

describe('ParameterConditionPlacementOptimizer', () => {
    it('moves a simple final SELECT parameter predicate into the safe upstream CTE', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.customer_id, o.created_at, o.status
                from orders o
            )
            select ob.order_id, ob.customer_id
            from orders_base ob
            where ob.customer_id = :customer_id
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                kind: 'move_condition',
                conditionSql: '"ob"."customer_id" = :customer_id',
                fromScopeId: 'scope:root',
                toScopeId: 'cte:orders_base'
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(result.safety).toEqual(expect.objectContaining({
            mode: 'safe_only',
            unsafeRewriteApplied: false
        }));
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with orders_base as (
                select o.order_id, o.customer_id, o.created_at, o.status
                from orders o
                where o.customer_id = :customer_id
            )
            select ob.order_id, ob.customer_id
            from orders_base ob
        `));
    });

    it('keeps the moved search predicate in the CTE body when the optimized SQL is decomposed', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.customer_id, o.created_at, o.status
                from orders o
            )
            select ob.order_id, ob.customer_id
            from orders_base ob
            where ob.customer_id = :customer_id
        `;

        const result = optimizeParameterConditionPlacement(sql);
        const normalized = normalizeSql(result.sql);

        expect(normalized).toContain('from "orders" as "o" where "o"."customer_id" = :customer_id');
        expect(normalized).not.toContain('from "orders_base" as "ob" where "ob"."customer_id" = :customer_id');
    });

    it('preserves existing comments when moving a parameter predicate', () => {
        const sql = `
            with
            -- orders scope comment
            orders_base as (
                select
                    o.order_id,
                    o.customer_id -- customer id projection comment
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where ob.customer_id = :customer_id
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.sql).toContain('orders scope comment');
        expect(result.sql).toContain('customer id projection comment');
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with orders_base as (
                select o.order_id, o.customer_id
                from orders o
                where o.customer_id = :customer_id
            )
            select ob.order_id
            from orders_base ob
        `));
    });

    it('moves simple IN parameter predicates when the target column resolves safely', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.status
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where ob.status in (:status)
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toHaveLength(1);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with orders_base as (
                select o.order_id, o.status
                from orders o
                where o.status in (:status)
            )
            select ob.order_id
            from orders_base ob
        `));
    });

    it('accepts an AST input without mutating the caller-owned query', () => {
        const query = SelectQueryParser.parse(`
            with orders_base as (
                select o.order_id, o.customer_id
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where ob.customer_id = :customer_id
        `);
        const before = new SqlFormatter().format(query).formattedSql;

        const result = planParameterConditionOptimization(query);

        expect(result.ok).toBe(true);
        expect(result.applied).toHaveLength(1);
        expect(new SqlFormatter().format(query).formattedSql).toBe(before);
        expect(normalizeSql(result.sql)).toContain('where "o"."customer_id" = :customer_id');
    });

    it('is a no-op when the parameter predicate is already inside the upstream CTE', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.customer_id
                from orders o
                where o.customer_id = :customer_id
            )
            select ob.order_id
            from orders_base ob
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips ambiguous unqualified column resolution', () => {
        const sql = `
            with users_base as (
                select u.id, u.name
                from users u
            ),
            orders_base as (
                select o.id, o.total
                from orders o
            )
            select u.id, o.id
            from users_base u
            join orders_base o on o.id = u.id
            where id = :id
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                conditionSql: '"id" = :id',
                reason: expect.stringMatching(/ambiguous/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips predicates that reference the nullable side of a LEFT JOIN', () => {
        const sql = `
            with orders_base as (
                select o.order_id
                from orders o
            ),
            payments_base as (
                select p.order_id, p.status
                from payments p
            )
            select o.order_id
            from orders_base o
            left join payments_base p on p.order_id = o.order_id
            where p.status = :status
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                reason: expect.stringMatching(/left join nullable side/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips predicates that would cross GROUP BY boundaries', () => {
        const sql = `
            with order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                group by o.customer_id
            )
            select ot.customer_id, ot.order_count
            from order_totals ot
            where ot.customer_id = :customer_id
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                reason: expect.stringMatching(/group by/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips predicates that would cross DISTINCT boundaries', () => {
        const sql = `
            with distinct_customers as (
                select distinct o.customer_id
                from orders o
            )
            select dc.customer_id
            from distinct_customers dc
            where dc.customer_id = :customer_id
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                reason: expect.stringMatching(/distinct/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips predicates that would require UNION branch distribution', () => {
        const sql = `
            with combined_orders as (
                select o.customer_id
                from orders o
                union all
                select a.customer_id
                from archived_orders a
            )
            select co.customer_id
            from combined_orders co
            where co.customer_id = :customer_id
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                reason: expect.stringMatching(/union/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips predicates that would cross WINDOW boundaries', () => {
        const sql = `
            with ranked_orders as (
                select
                    o.customer_id,
                    row_number() over (partition by o.customer_id order by o.created_at desc) as row_num
                from orders o
            )
            select ro.customer_id
            from ranked_orders ro
            where ro.customer_id = :customer_id
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                reason: expect.stringMatching(/window/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips function predicates because volatility cannot be proven safely', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.status
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where lower(ob.status) = :status
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                reason: expect.stringMatching(/function call/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips OR predicates in the first safe-only implementation', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.customer_id, o.status
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where ob.customer_id = :customer_id or ob.status = :status
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                reason: expect.stringMatching(/or predicates/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });
});
