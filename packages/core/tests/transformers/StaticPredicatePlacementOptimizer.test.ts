import { describe, expect, it } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import {
    optimizeStaticPredicatePlacement,
    planStaticPredicatePlacement
} from '../../src/transformers/StaticPredicatePlacementOptimizer';

const normalizeSql = (sql: string): string => {
    const query = SelectQueryParser.parse(sql);
    return new SqlFormatter().format(query).formattedSql;
};

describe('StaticPredicatePlacementOptimizer', () => {
    it('moves a correlated EXISTS static predicate into a safe upstream CTE and rebases the outer reference', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.name
                from customers c
            )
            select cs.id
            from customer_scope cs
            where exists (
                select 1
                from customer_favorites cf
                where cf.customer_id = cs.id
                  and cf.is_active = true
            )
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                kind: 'move_static_predicate',
                predicateSql: expect.stringContaining('exists'),
                fromScopeId: 'scope:root',
                toScopeId: 'cte:customer_scope',
                columnReferences: ['cs.id']
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with customer_scope as (
                select c.id, c.name
                from customers c
                where exists (
                    select 1
                    from customer_favorites cf
                    where cf.customer_id = c.id
                      and cf.is_active = true
                )
            )
            select cs.id
            from customer_scope cs
        `));
    });

    it('recursively moves static predicates through grouped CTE keys into direct preserved-side source columns', () => {
        const sql = `
            with
              source_summary as (
                select
                  t1.group_id,
                  t1.org_id,
                  count(t1.group_id) as item_count
                from source_table as t1
                group by
                  t1.group_id,
                  t1.org_id
              ),
              target_summary as (
                select
                  t2.group_id,
                  m.org_id,
                  count(t2.group_id) as item_count
                from target_table as t2
                inner join master_table as m
                  on t2.related_id = m.related_id
                group by
                  t2.group_id,
                  m.org_id
              ),
              detail_data as (
                select
                  o.org_id,
                  o.org_name,
                  s.group_id,
                  s.item_count as source_count,
                  t.item_count as target_count
                from organization as o
                left join source_summary as s
                  on o.org_id = s.org_id
                left join target_summary as t
                  on s.group_id = t.group_id
                where
                  o.enabled_flg = true
              ),
              report as (
                select
                  org_id,
                  org_name,
                  sum(source_count) as source_count,
                  sum(target_count) as target_count
                from detail_data
                group by
                  org_id,
                  org_name
              )
            select
              org_id,
              org_name,
              source_count,
              target_count
            from report
            where org_id in (1)
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                fromScopeId: 'scope:root',
                toScopeId: 'cte:report',
                predicateSql: '"org_id" in (1)'
            }),
            expect.objectContaining({
                fromScopeId: 'cte:report',
                toScopeId: 'cte:detail_data',
                predicateSql: '"org_id" in (1)',
                reason: expect.stringMatching(/direct output|rebased|recursive/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with
              source_summary as (
                select
                  t1.group_id,
                  t1.org_id,
                  count(t1.group_id) as item_count
                from source_table as t1
                group by
                  t1.group_id,
                  t1.org_id
              ),
              target_summary as (
                select
                  t2.group_id,
                  m.org_id,
                  count(t2.group_id) as item_count
                from target_table as t2
                inner join master_table as m
                  on t2.related_id = m.related_id
                group by
                  t2.group_id,
                  m.org_id
              ),
              detail_data as (
                select
                  o.org_id,
                  o.org_name,
                  s.group_id,
                  s.item_count as source_count,
                  t.item_count as target_count
                from organization as o
                left join source_summary as s
                  on o.org_id = s.org_id
                left join target_summary as t
                  on s.group_id = t.group_id
                where
                  o.enabled_flg = true
                  and o.org_id in (1)
              ),
              report as (
                select
                  org_id,
                  org_name,
                  sum(source_count) as source_count,
                  sum(target_count) as target_count
                from detail_data
                group by
                  org_id,
                  org_name
              )
            select
              org_id,
              org_name,
              source_count,
              target_count
            from report
        `));
    });

    it('does not recursively push predicates into the nullable side of a LEFT JOIN', () => {
        const sql = `
            with
              detail_data as (
                select
                  o.org_id,
                  s.item_count as source_count
                from organization as o
                left join source_summary as s
                  on o.org_id = s.org_id
              )
            select *
            from detail_data
            where source_count > 0
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'OUTER_JOIN_NULLABLE_SIDE'
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('moves simple boolean and NULL static predicates into the safe upstream CTE', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.is_active, c.deleted_at
                from customers c
            )
            select cs.id
            from customer_scope cs
            where cs.is_active = true
              and cs.deleted_at is null
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toHaveLength(2);
        expect(result.applied.map(item => item.columnReferences)).toEqual([
            ['cs.is_active'],
            ['cs.deleted_at']
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with customer_scope as (
                select c.id, c.is_active, c.deleted_at
                from customers c
                where c.is_active = true
                  and c.deleted_at is null
            )
            select cs.id
            from customer_scope cs
        `));
    });

    it('moves static BETWEEN predicates with literals into the safe upstream CTE', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.order_date
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where ob.order_date between date '2024-01-01' and date '2024-02-01'
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                predicateSql: `"ob"."order_date" between date '2024-01-01' and date '2024-02-01'`,
                columnReferences: ['ob.order_date']
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with orders_base as (
                select o.order_id, o.order_date
                from orders o
                where o.order_date between date '2024-01-01' and date '2024-02-01'
            )
            select ob.order_id
            from orders_base ob
        `));
    });

    it('moves a whole static BETWEEN predicate when all column references resolve to the same direct upstream output group', () => {
        const sql = `
            with x as (
                select t.a, t.b, t.c
                from t
            )
            select *
            from x
            where a between b and c
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                predicateSql: '"a" between "b" and "c"',
                columnReferences: ['a', 'b', 'c']
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with x as (
                select t.a, t.b, t.c
                from t
                where t.a between t.b and t.c
            )
            select *
            from x
        `));
    });

    it('splits only top-level AND terms inside nested parentheses while keeping static OR predicates whole', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.is_active, c.deleted_at, c.region
                from customers c
            )
            select cs.id
            from customer_scope cs
            where (((cs.is_active = true or cs.deleted_at is null) and cs.region = 'west'))
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.applied).toEqual([
            expect.objectContaining({
                predicateSql: '("cs"."is_active" = true or "cs"."deleted_at" is null)',
                columnReferences: ['cs.is_active', 'cs.deleted_at']
            }),
            expect.objectContaining({
                predicateSql: `"cs"."region" = 'west'`,
                columnReferences: ['cs.region']
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with customer_scope as (
                select c.id, c.is_active, c.deleted_at, c.region
                from customers c
                where (c.is_active = true or c.deleted_at is null)
                  and c.region = 'west'
            )
            select cs.id
            from customer_scope cs
        `));
    });

    it('is a no-op when the static predicate is already in the upstream CTE', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.is_active
                from customers c
                where c.is_active = true
            )
            select cs.id
            from customer_scope cs
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('does not handle parameter predicates or SSSQL optional predicates', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.region, c.customer_tier
                from customers c
            )
            select cs.id
            from customer_scope cs
            where cs.region = :region
              and (:customer_tier is null or cs.customer_tier = :customer_tier)
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips predicates that reference the nullable side of a LEFT JOIN', () => {
        const sql = `
            with customer_scope as (
                select c.id
                from customers c
            ),
            payment_scope as (
                select p.customer_id, p.is_successful
                from payments p
            )
            select cs.id
            from customer_scope cs
            left join payment_scope ps on ps.customer_id = cs.id
            where ps.is_successful = true
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'OUTER_JOIN_NULLABLE_SIDE',
                reason: expect.stringMatching(/left join nullable side/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips predicates when a later RIGHT or FULL JOIN can null the joined source', () => {
        for (const joinType of ['RIGHT JOIN', 'FULL JOIN']) {
            const sql = `
                with customer_scope as (
                    select c.id
                    from customers c
                ),
                order_scope as (
                    select o.customer_id, o.is_open
                    from orders o
                ),
                region_scope as (
                    select r.customer_id
                    from regions r
                )
                select cs.id
                from customer_scope cs
                join order_scope os on os.customer_id = cs.id
                ${joinType} region_scope rs on rs.customer_id = cs.id
                where os.is_open = true
            `;

            const result = optimizeStaticPredicatePlacement(sql);

            expect(result.applied).toEqual([]);
            expect(result.skipped).toEqual([
                expect.objectContaining({
                    code: 'OUTER_JOIN_NULLABLE_SIDE',
                    reason: expect.stringMatching(/right\/full join nullable side/i)
                })
            ]);
            expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
        }
    });

    it('moves constant predicates that reference only grouped upstream keys', () => {
        const groupByResult = optimizeStaticPredicatePlacement(`
            with order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                group by o.customer_id
            )
            select ot.customer_id
            from order_totals ot
            where ot.customer_id = 10
        `);

        expect(groupByResult.applied).toEqual([
            expect.objectContaining({
                kind: 'move_static_predicate',
                predicateSql: '"ot"."customer_id" = 10',
                toScopeId: 'cte:order_totals',
                reason: expect.stringMatching(/GROUP BY key/i)
            })
        ]);
        expect(groupByResult.skipped).toEqual([]);
        expect(normalizeSql(groupByResult.sql)).toBe(normalizeSql(`
            with order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                where o.customer_id = 10
                group by o.customer_id
            )
            select ot.customer_id
            from order_totals ot
        `));
    });

    it('moves static predicates through single-source wildcard wrappers up to the aggregate boundary', () => {
        const result = optimizeStaticPredicatePlacement(`
            select *
            from (
                select *
                from (
                    select sum(price) as price
                    from a
                ) as a
            ) as a
            where price > 100
        `);

        expect(result.applied).toEqual([
            expect.objectContaining({
                kind: 'move_static_predicate',
                predicateSql: '"price" > 100',
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
                where a.price > 100
            ) as a
        `));
    });

    it('keeps wildcard passthrough predicates blocked when duplicate outputs are possible', () => {
        const sql = `
            select *
            from (
                select *
                from (
                    select a.id, b.id
                    from a
                    join b on b.a_id = a.id
                ) as joined
            ) as d
            where id = 1
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'AMBIGUOUS_COLUMN_REFERENCE',
                reason: expect.stringMatching(/multiple outputs/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('does not push static aggregate result predicates into grouped upstream WHERE', () => {
        const result = optimizeStaticPredicatePlacement(`
            with order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                group by o.customer_id
            )
            select ot.customer_id, ot.order_count
            from order_totals ot
            where ot.order_count >= 3
        `);

        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'EXPRESSION_OUTPUT_UNSUPPORTED'
            })
        ]);
        expect(normalizeSql(result.sql)).toContain('from "order_totals" as "ot" where "ot"."order_count" >= 3');
        expect(normalizeSql(result.sql)).not.toContain('where count(*) >= 3');
    });

    it('moves static grouped key predicates without moving HAVING predicates', () => {
        const result = optimizeStaticPredicatePlacement(`
            with order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                group by o.customer_id
                having count(*) >= 3
            )
            select ot.customer_id, ot.order_count
            from order_totals ot
            where ot.customer_id = 10
        `);

        expect(result.applied).toEqual([
            expect.objectContaining({
                predicateSql: '"ot"."customer_id" = 10',
                reason: expect.stringMatching(/GROUP BY key/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                where o.customer_id = 10
                group by o.customer_id
                having count(*) >= 3
            )
            select ot.customer_id, ot.order_count
            from order_totals ot
        `));
    });

    it('moves static predicates through ordinary DISTINCT direct output columns', () => {
        const result = optimizeStaticPredicatePlacement(`
            with distinct_orders as (
                select distinct o.customer_id, o.status
                from orders o
            )
            select d.customer_id
            from distinct_orders d
            where d.status = 'paid'
        `);

        expect(result.applied).toEqual([
            expect.objectContaining({
                kind: 'move_static_predicate',
                predicateSql: `"d"."status" = 'paid'`,
                toScopeId: 'cte:distinct_orders',
                reason: expect.stringMatching(/DISTINCT output column/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with distinct_orders as (
                select distinct o.customer_id, o.status
                from orders o
                where o.status = 'paid'
            )
            select d.customer_id
            from distinct_orders d
        `));
    });

    it('keeps DISTINCT ON static predicates blocked', () => {
        const sql = `
            with latest_orders as (
                select distinct on (o.customer_id) o.customer_id, o.status
                from orders o
            )
            select lo.customer_id
            from latest_orders lo
            where lo.status = 'paid'
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'DISTINCT_BOUNDARY',
                reason: expect.stringMatching(/DISTINCT ON/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('keeps DISTINCT expression aliases blocked for static predicates', () => {
        const sql = `
            with monthly_orders as (
                select distinct date_trunc('month', o.created_at) as order_month
                from orders o
            )
            select mo.order_month
            from monthly_orders mo
            where mo.order_month = '2026-01-01'
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'EXPRESSION_OUTPUT_UNSUPPORTED'
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('moves static predicates through single-source DISTINCT wildcard outputs', () => {
        const result = optimizeStaticPredicatePlacement(`
            select d.customer_id
            from (
                select distinct *
                from (
                    select o.customer_id, o.status
                    from orders o
                ) as o
            ) as d
            where d.status = 'paid'
        `);

        expect(result.applied).toEqual([
            expect.objectContaining({
                kind: 'move_static_predicate',
                predicateSql: `"d"."status" = 'paid'`,
                toScopeId: 'subquery:d',
                reason: expect.stringMatching(/DISTINCT output column/i)
            }),
            expect.objectContaining({
                kind: 'move_static_predicate',
                fromScopeId: 'subquery:d',
                predicateSql: `"o"."status" = 'paid'`,
                toScopeId: 'subquery:o',
                reason: expect.stringMatching(/rebased/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            select d.customer_id
            from (
                select distinct *
                from (
                    select o.customer_id, o.status
                    from orders o
                    where o.status = 'paid'
                ) as o
            ) as d
        `));
    });

    it('skips unsafe UNION branches', () => {

        const unionResult = optimizeStaticPredicatePlacement(`
            with combined_customers as (
                select c.id
                from customers c
                union all
                select coalesce(a.id, 0) as id
                from archived_customers a
            )
            select cc.id
            from combined_customers cc
            where cc.id = 10
        `);

        expect(unionResult.skipped).toEqual([
            expect.objectContaining({ code: 'EXPRESSION_OUTPUT_UNSUPPORTED' })
        ]);
    });

    it('distributes static predicates into UNION branches by output position', () => {
        const sql = `
            with customer_statuses as (
                select c.id as customer_id, c.status as status_label
                from customers c
                union all
                select a.legacy_customer_id as ignored_customer_id, a.lifecycle_status as ignored_status
                from archived_customers a
            )
            select cs.customer_id
            from customer_statuses cs
            where cs.status_label = 'active'
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                predicateSql: `"cs"."status_label" = 'active'`,
                toScopeId: 'cte:customer_statuses',
                reason: expect.stringMatching(/output column position/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with customer_statuses as (
                select c.id as customer_id, c.status as status_label
                from customers c
                where c.status = 'active'
                union all
                select a.legacy_customer_id as ignored_customer_id, a.lifecycle_status as ignored_status
                from archived_customers a
                where a.lifecycle_status = 'active'
            )
            select cs.customer_id
            from customer_statuses cs
        `));
    });

    it('moves UNION branch static predicates into branch-local upstream CTEs when safe', () => {
        const sql = `
            with current_accounts as (
                select c.id, c.status
                from customers c
            ),
            legacy_accounts as (
                select a.legacy_customer_id, a.lifecycle_status
                from archived_customers a
            ),
            customer_statuses as (
                select ca.id as customer_id, ca.status as status_label
                from current_accounts ca
                union all
                select la.legacy_customer_id as ignored_customer_id, la.lifecycle_status as ignored_status
                from legacy_accounts la
            )
            select cs.customer_id
            from customer_statuses cs
            where cs.status_label = 'active'
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                predicateSql: `"cs"."status_label" = 'active'`,
                reason: expect.stringMatching(/output column position/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with current_accounts as (
                select c.id, c.status
                from customers c
                where c.status = 'active'
            ),
            legacy_accounts as (
                select a.legacy_customer_id, a.lifecycle_status
                from archived_customers a
                where a.lifecycle_status = 'active'
            ),
            customer_statuses as (
                select ca.id as customer_id, ca.status as status_label
                from current_accounts ca
                union all
                select la.legacy_customer_id as ignored_customer_id, la.lifecycle_status as ignored_status
                from legacy_accounts la
            )
            select cs.customer_id
            from customer_statuses cs
        `));
    });

    it('moves a whole static OR predicate when every reference targets the same upstream CTE', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.is_active, c.deleted_at
                from customers c
            )
            select cs.id
            from customer_scope cs
            where cs.is_active = true or cs.deleted_at is null
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.applied).toEqual([
            expect.objectContaining({
                predicateSql: '"cs"."is_active" = true or "cs"."deleted_at" is null',
                columnReferences: ['cs.is_active', 'cs.deleted_at']
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with customer_scope as (
                select c.id, c.is_active, c.deleted_at
                from customers c
                where c.is_active = true or c.deleted_at is null
            )
            select cs.id
            from customer_scope cs
        `));
    });

    it('distributes whole static OR predicates into UNION branches by output position', () => {
        const sql = `
            with customer_statuses as (
                select c.id as customer_id, c.status as status_label, c.channel as channel_label
                from customers c
                union all
                select a.legacy_customer_id as ignored_customer_id, a.lifecycle_status as ignored_status, a.source_channel as ignored_channel
                from archived_customers a
            )
            select cs.customer_id
            from customer_statuses cs
            where (cs.status_label = 'active' or cs.channel_label = 'web')
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                predicateSql: `("cs"."status_label" = 'active' or "cs"."channel_label" = 'web')`,
                columnReferences: ['cs.status_label', 'cs.channel_label'],
                reason: expect.stringMatching(/output column position/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with customer_statuses as (
                select c.id as customer_id, c.status as status_label, c.channel as channel_label
                from customers c
                where (c.status = 'active' or c.channel = 'web')
                union all
                select a.legacy_customer_id as ignored_customer_id, a.lifecycle_status as ignored_status, a.source_channel as ignored_channel
                from archived_customers a
                where (a.lifecycle_status = 'active' or a.source_channel = 'web')
            )
            select cs.customer_id
            from customer_statuses cs
        `));
    });

    it('distributes static BETWEEN predicates with column bounds into branch-local upstream CTEs when safe', () => {
        const sql = `
            with current_orders as (
                select o.id, o.order_date, o.window_start, o.window_end
                from orders o
            ),
            archived_orders_scope as (
                select a.id, a.ship_date, a.start_date, a.end_date
                from archived_orders a
            ),
            combined_orders as (
                select co.id as order_id, co.order_date as target_date, co.window_start as lower_bound, co.window_end as upper_bound
                from current_orders co
                union all
                select ao.id as ignored_id, ao.ship_date as ignored_target, ao.start_date as ignored_lower, ao.end_date as ignored_upper
                from archived_orders_scope ao
            )
            select co.order_id
            from combined_orders co
            where co.target_date between co.lower_bound and co.upper_bound
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                predicateSql: '"co"."target_date" between "co"."lower_bound" and "co"."upper_bound"',
                columnReferences: ['co.target_date', 'co.lower_bound', 'co.upper_bound'],
                reason: expect.stringMatching(/output column position/i)
            })
        ]);
        expect(result.skipped).toEqual([]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with current_orders as (
                select o.id, o.order_date, o.window_start, o.window_end
                from orders o
                where o.order_date between o.window_start and o.window_end
            ),
            archived_orders_scope as (
                select a.id, a.ship_date, a.start_date, a.end_date
                from archived_orders a
                where a.ship_date between a.start_date and a.end_date
            ),
            combined_orders as (
                select co.id as order_id, co.order_date as target_date, co.window_start as lower_bound, co.window_end as upper_bound
                from current_orders co
                union all
                select ao.id as ignored_id, ao.ship_date as ignored_target, ao.start_date as ignored_lower, ao.end_date as ignored_upper
                from archived_orders_scope ao
            )
            select co.order_id
            from combined_orders co
        `));
    });

    it('skips whole static OR and BETWEEN predicates whose references span multiple sources', () => {
        const orSql = `
            with customer_scope as (
                select c.id, c.is_active
                from customers c
            ),
            payment_scope as (
                select p.customer_id, p.is_successful
                from payments p
            )
            select x.id
            from customer_scope x
            join payment_scope y on y.customer_id = x.id
            where x.is_active = true or y.is_successful = true
        `;
        const betweenSql = `
            with x as (
                select c.id, c.a, c.b
                from customers c
            ),
            y as (
                select p.customer_id, p.c
                from payments p
            )
            select x.id
            from x
            join y on y.customer_id = x.id
            where x.a between x.b and y.c
        `;

        const orResult = optimizeStaticPredicatePlacement(orSql);
        const betweenResult = optimizeStaticPredicatePlacement(betweenSql);

        expect(orResult.applied).toEqual([]);
        expect(orResult.skipped).toEqual([
            expect.objectContaining({ code: 'MULTIPLE_SOURCE_REFERENCES' })
        ]);
        expect(normalizeSql(orResult.sql)).toBe(normalizeSql(orSql));
        expect(betweenResult.applied).toEqual([]);
        expect(betweenResult.skipped).toEqual([
            expect.objectContaining({ code: 'MULTIPLE_SOURCE_REFERENCES' })
        ]);
        expect(normalizeSql(betweenResult.sql)).toBe(normalizeSql(betweenSql));
    });

    it('skips whole static OR predicates that contain unsafe expressions', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.status, c.is_active
                from customers c
            )
            select cs.id
            from customer_scope cs
            where lower(cs.status) = 'active' or cs.is_active = true
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'FUNCTION_PREDICATE_UNSUPPORTED'
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips whole static OR predicates that contain subqueries instead of moving a partial predicate', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.is_active
                from customers c
            )
            select cs.id
            from customer_scope cs
            where cs.is_active = true or exists (
                select 1
                from customer_favorites cf
                where cf.customer_id = cs.id
            )
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'SUBQUERY_PREDICATE_UNSUPPORTED'
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips whole static OR predicates when one branch depends on an aggregate expression output', () => {
        const sql = `
            with order_totals as (
                select o.customer_id, sum(o.amount) as total_amount
                from orders o
                group by o.customer_id
            )
            select ot.customer_id
            from order_totals ot
            where ot.customer_id = 10 or ot.total_amount > 100
        `;

        const result = optimizeStaticPredicatePlacement(sql);

        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'EXPRESSION_OUTPUT_UNSUPPORTED'
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('skips reused CTEs, expression outputs, and function predicates', () => {
        const reusedCteResult = optimizeStaticPredicatePlacement(`
            with customer_scope as (
                select c.id, c.is_active
                from customers c
            )
            select left_cs.id
            from customer_scope left_cs
            join customer_scope right_cs on right_cs.id = left_cs.id
            where left_cs.is_active = true
        `);

        const expressionOutputResult = optimizeStaticPredicatePlacement(`
            with customer_scope as (
                select c.id, lower(c.status) as status
                from customers c
            )
            select cs.id
            from customer_scope cs
            where cs.status = 'active'
        `);

        const functionPredicateResult = optimizeStaticPredicatePlacement(`
            with customer_scope as (
                select c.id, c.status
                from customers c
            )
            select cs.id
            from customer_scope cs
            where lower(cs.status) = 'active'
        `);

        expect(reusedCteResult.skipped).toEqual([
            expect.objectContaining({ code: 'CTE_REUSE_UNSUPPORTED' })
        ]);
        expect(expressionOutputResult.skipped).toEqual([
            expect.objectContaining({ code: 'EXPRESSION_OUTPUT_UNSUPPORTED' })
        ]);
        expect(functionPredicateResult.skipped).toEqual([
            expect.objectContaining({ code: 'FUNCTION_PREDICATE_UNSUPPORTED' })
        ]);
    });

    it('returns a dry-run plan without mutating caller-owned AST input', () => {
        const query = SelectQueryParser.parse(`
            with customer_scope as (
                select c.id, c.is_active
                from customers c
            )
            select cs.id
            from customer_scope cs
            where cs.is_active = true
        `);
        const before = new SqlFormatter().format(query).formattedSql;

        const result = planStaticPredicatePlacement(query);

        expect(result.ok).toBe(true);
        expect(result.safety).toEqual(expect.objectContaining({
            mode: 'safe_only',
            unsafeRewriteApplied: false,
            dryRun: true,
            formatterGeneratedSource: true
        }));
        expect(result.applied).toHaveLength(1);
        expect(new SqlFormatter().format(query).formattedSql).toBe(before);
        expect(normalizeSql(result.sql)).toContain('where "c"."is_active" = true');
    });

    it('returns the optimized query model and applies caller format options to SQL output', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.is_active
                from customers c
            )
            select cs.id
            from customer_scope cs
            where cs.is_active = true
        `;
        const formatOptions = {
            keywordCase: 'upper' as const,
            identifierEscape: { start: '', end: '' }
        };

        const result = optimizeStaticPredicatePlacement(sql, { formatOptions });

        expect(result.ok).toBe(true);
        expect(result.query).not.toBeNull();
        expect(result.sql).toBe(new SqlFormatter(formatOptions).format(result.query!).formattedSql);
        expect(result.sql).toContain('WITH customer_scope AS');
        expect(result.sql).toContain('WHERE c.is_active = true');
    });
});
