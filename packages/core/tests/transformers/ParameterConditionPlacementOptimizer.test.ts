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

    it('returns the optimized query model and applies caller format options to SQL output', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.customer_id
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where ob.customer_id = :customer_id
        `;
        const formatOptions = {
            keywordCase: 'upper' as const,
            identifierEscape: { start: '', end: '' }
        };

        const result = optimizeParameterConditionPlacement(sql, { formatOptions });

        expect(result.ok).toBe(true);
        expect(result.query).not.toBeNull();
        expect(result.sql).toBe(new SqlFormatter(formatOptions).format(result.query!).formattedSql);
        expect(result.sql).toContain('WITH orders_base AS');
        expect(result.sql).toContain('WHERE o.customer_id = :customer_id');
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

    it('moves same-block WHERE predicates even when the root query groups later', () => {
        const sql = `
            with orders_base as (
                select o.customer_id, o.status
                from orders o
            )
            select ob.customer_id, count(*) as order_count
            from orders_base ob
            where ob.status = :status
            group by ob.customer_id
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                kind: 'move_condition',
                conditionSql: '"ob"."status" = :status',
                toScopeId: 'cte:orders_base'
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with orders_base as (
                select o.customer_id, o.status
                from orders o
                where o.status = :status
            )
            select ob.customer_id, count(*) as order_count
            from orders_base ob
            group by ob.customer_id
        `));
    });

    it('moves parameter predicates through single-source wildcard wrappers up to the aggregate boundary', () => {
        const sql = `
            select *
            from (
                select *
                from (
                    select sum(price) as price
                    from a
                ) as a
            ) as a
            where price > :minimum_price
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                kind: 'move_condition',
                conditionSql: '"price" > :minimum_price',
                toScopeId: 'subquery:a'
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            select *
            from (
                select *
                from (
                    select sum(price) as price
                    from a
                ) as a
                where a.price > :minimum_price
            ) as a
        `));
    });

    it('moves outer WHERE predicates that reference only grouped upstream keys', () => {
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
        expect(result.applied).toEqual([
            expect.objectContaining({
                kind: 'move_condition',
                conditionSql: '"ot"."customer_id" = :customer_id',
                toScopeId: 'cte:order_totals',
                reason: expect.stringMatching(/GROUP BY key/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                where o.customer_id = :customer_id
                group by o.customer_id
            )
            select ot.customer_id, ot.order_count
            from order_totals ot
        `));
    });

    it('moves grouped key predicates without moving HAVING predicates', () => {
        const sql = `
            with order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                group by o.customer_id
                having count(*) >= :minimum_order_count
            )
            select ot.customer_id, ot.order_count
            from order_totals ot
            where ot.customer_id = :customer_id
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                conditionSql: '"ot"."customer_id" = :customer_id',
                reason: expect.stringMatching(/GROUP BY key/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                where o.customer_id = :customer_id
                group by o.customer_id
                having count(*) >= :minimum_order_count
            )
            select ot.customer_id, ot.order_count
            from order_totals ot
        `));
    });

    it('does not optimize HAVING predicates as pre-aggregation WHERE predicates', () => {
        const sql = `
            select o.customer_id, count(*) as order_count
            from orders o
            group by o.customer_id
            having count(*) >= :minimum_order_count
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('does not push aggregate result predicates into grouped upstream WHERE', () => {
        const sql = `
            with order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                group by o.customer_id
            )
            select ot.customer_id, ot.order_count
            from order_totals ot
            where ot.order_count >= :minimum_order_count
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'EXPRESSION_OUTPUT_UNSUPPORTED',
                reason: expect.stringMatching(/expression/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
        expect(normalizeSql(result.sql)).not.toContain('where count(*) >= :minimum_order_count');
    });

    it('moves only grouped key predicates when outer WHERE also filters aggregate results', () => {
        const sql = `
            with order_totals as (
                select o.customer_id, sum(o.amount) as total_amount
                from orders o
                group by o.customer_id
            )
            select ot.customer_id, ot.total_amount
            from order_totals ot
            where ot.customer_id = :customer_id
              and ot.total_amount >= :minimum_total_amount
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                conditionSql: '"ot"."customer_id" = :customer_id',
                reason: expect.stringMatching(/GROUP BY key/i)
            })
        ]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                conditionSql: '"ot"."total_amount" >= :minimum_total_amount',
                code: 'EXPRESSION_OUTPUT_UNSUPPORTED'
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with order_totals as (
                select o.customer_id, sum(o.amount) as total_amount
                from orders o
                where o.customer_id = :customer_id
                group by o.customer_id
            )
            select ot.customer_id, ot.total_amount
            from order_totals ot
            where ot.total_amount >= :minimum_total_amount
        `));
    });

    it('keeps grouped expression aliases blocked when they cannot be safely mapped to a GROUP BY key', () => {
        const sql = `
            with monthly_orders as (
                select date_trunc('month', o.created_at) as order_month, count(*) as order_count
                from orders o
                group by date_trunc('month', o.created_at)
            )
            select mo.order_month, mo.order_count
            from monthly_orders mo
            where mo.order_month = :order_month
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'EXPRESSION_OUTPUT_UNSUPPORTED'
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('keeps function predicates blocked instead of guessing grouped-key dependencies', () => {
        const sql = `
            with regional_orders as (
                select o.customer_id, o.region, count(*) as order_count
                from orders o
                group by o.customer_id, o.region
            )
            select ro.customer_id, ro.region, ro.order_count
            from regional_orders ro
            where some_unknown_function(ro.region) = :region
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'FUNCTION_PREDICATE_UNSUPPORTED'
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

    it('distributes predicates into UNION branches', () => {
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
        expect(result.applied).toEqual([
            expect.objectContaining({
                toScopeId: 'cte:combined_orders',
                reason: expect.stringMatching(/UNION branch by output column position/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with combined_orders as (
                select o.customer_id
                from orders o
                where o.customer_id = :customer_id
                union all
                select a.customer_id
                from archived_orders a
                where a.customer_id = :customer_id
            )
            select co.customer_id
            from combined_orders co
        `));
    });

    it('maps UNION predicates by output position instead of later branch aliases', () => {
        const sql = `
            with combined_accounts as (
                select c.id as account_id, c.status as account_status
                from customers c
                union all
                select a.legacy_customer_id as ignored_id, a.lifecycle_status as ignored_status
                from archived_customers a
            )
            select ca.account_id
            from combined_accounts ca
            where ca.account_status = :status
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                conditionSql: '"ca"."account_status" = :status',
                reason: expect.stringMatching(/output column position/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with combined_accounts as (
                select c.id as account_id, c.status as account_status
                from customers c
                where c.status = :status
                union all
                select a.legacy_customer_id as ignored_id, a.lifecycle_status as ignored_status
                from archived_customers a
                where a.lifecycle_status = :status
            )
            select ca.account_id
            from combined_accounts ca
        `));
    });

    it('moves UNION branch predicates into branch-local upstream CTEs when safe', () => {
        const sql = `
            with current_accounts as (
                select c.id, c.status
                from customers c
            ),
            legacy_accounts as (
                select a.legacy_customer_id, a.lifecycle_status
                from archived_customers a
            ),
            combined_accounts as (
                select ca.id as account_id, ca.status as account_status
                from current_accounts ca
                union all
                select la.legacy_customer_id as ignored_id, la.lifecycle_status as ignored_status
                from legacy_accounts la
            )
            select ca.account_id
            from combined_accounts ca
            where ca.account_status = :status
        `;

        const result = optimizeParameterConditionPlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                conditionSql: '"ca"."account_status" = :status',
                reason: expect.stringMatching(/output column position/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with current_accounts as (
                select c.id, c.status
                from customers c
                where c.status = :status
            ),
            legacy_accounts as (
                select a.legacy_customer_id, a.lifecycle_status
                from archived_customers a
                where a.lifecycle_status = :status
            ),
            combined_accounts as (
                select ca.id as account_id, ca.status as account_status
                from current_accounts ca
                union all
                select la.legacy_customer_id as ignored_id, la.lifecycle_status as ignored_status
                from legacy_accounts la
            )
            select ca.account_id
            from combined_accounts ca
        `));
    });

    it('keeps UNION predicates outside when any branch output is not a direct column', () => {
        const sql = `
            with combined_orders as (
                select o.customer_id
                from orders o
                union all
                select coalesce(a.customer_id, 0) as customer_id
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
                code: 'EXPRESSION_OUTPUT_UNSUPPORTED'
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
