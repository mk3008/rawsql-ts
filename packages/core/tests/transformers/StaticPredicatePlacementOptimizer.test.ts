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

    it('skips GROUP BY, DISTINCT, and UNION boundaries', () => {
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

        const distinctResult = optimizeStaticPredicatePlacement(`
            with distinct_customers as (
                select distinct c.id
                from customers c
            )
            select dc.id
            from distinct_customers dc
            where dc.id = 10
        `);

        const unionResult = optimizeStaticPredicatePlacement(`
            with combined_customers as (
                select c.id
                from customers c
                union all
                select a.id
                from archived_customers a
            )
            select cc.id
            from combined_customers cc
            where cc.id = 10
        `);

        expect(groupByResult.skipped).toEqual([
            expect.objectContaining({ code: 'GROUP_BY_BOUNDARY' })
        ]);
        expect(distinctResult.skipped).toEqual([
            expect.objectContaining({ code: 'DISTINCT_BOUNDARY' })
        ]);
        expect(unionResult.skipped).toEqual([
            expect.objectContaining({ code: 'UNION_BOUNDARY' })
        ]);
    });

    it('skips OR predicates that would require boolean distribution', () => {
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

        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual([
            expect.objectContaining({
                code: 'OR_PREDICATE_UNSUPPORTED'
            })
        ]);
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
});
