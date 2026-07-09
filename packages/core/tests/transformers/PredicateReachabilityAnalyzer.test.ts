import { describe, expect, it } from 'vitest';
import {
    analyzePredicateReachability,
    SelectQueryParser,
    SqlFormatter
} from '../../src';

const normalizeSql = (sql: string): string => {
    const query = SelectQueryParser.parse(sql);
    return new SqlFormatter().format(query).formattedSql;
};

describe('PredicateReachabilityAnalyzer', () => {
    it('reports direct upstream reachability and debug-only JOIN equivalence branches without rewriting SQL', () => {
        const sql = `
            with order_scope as (
                select o.id, o.customer_id
                from orders o
            )
            select os.id
            from order_scope os
            join customers c on c.id = os.customer_id
            where os.customer_id = :customer_id
        `;

        const result = analyzePredicateReachability(sql);

        expect(result.ok).toBe(true);
        expect(result.safety).toEqual({
            mode: 'debug_only',
            sqlRewritten: false
        });
        expect(result.predicates).toEqual([
            expect.objectContaining({
                predicateSql: '"os"."customer_id" = :customer_id',
                originScopeId: 'scope:root',
                columnReferences: ['os.customer_id'],
                reaches: expect.arrayContaining([
                    expect.objectContaining({
                        scopeId: 'cte:order_scope',
                        relation: 'direct_output',
                        mode: 'rewrite_safe',
                        predicateSql: '"o"."customer_id" = :customer_id'
                    }),
                    expect.objectContaining({
                        scopeId: 'table:customers',
                        relation: 'join_equivalence',
                        mode: 'debug_only',
                        predicateSql: '"c"."id" = :customer_id',
                        via: ['"c"."id" = "os"."customer_id"']
                    })
                ])
            })
        ]);
        expect(result.predicates[0]!.blocked).toEqual([]);
        expect(result.predicates[0]!.probeTargets).toEqual(expect.arrayContaining([
            expect.objectContaining({
                scopeId: 'cte:order_scope',
                relation: 'direct_output',
                mode: 'rewrite_safe',
                predicateSql: '"o"."customer_id" = :customer_id',
                target: {
                    kind: 'cte',
                    name: 'order_scope'
                },
                probeKinds: ['count', 'sample']
            }),
            expect.objectContaining({
                scopeId: 'table:customers',
                relation: 'join_equivalence',
                mode: 'debug_only',
                predicateSql: '"c"."id" = :customer_id',
                target: {
                    kind: 'table',
                    name: 'customers'
                },
                probeKinds: ['count', 'sample'],
                caution: expect.stringContaining('debug-only')
            })
        ]));
        expect(result.query).not.toBeNull();
        expect(normalizeSql(new SqlFormatter().format(result.query!).formattedSql)).toBe(normalizeSql(sql));
    });

    it('reports LEFT JOIN preserved-side predicates as debug-only nullable-side probes', () => {
        const sql = `
            with order_scope as (
                select o.id, o.customer_id
                from orders o
            )
            select os.id
            from order_scope os
            left join customers c on c.id = os.customer_id
            where os.customer_id = :customer_id
        `;

        const result = analyzePredicateReachability(sql);

        expect(result.ok).toBe(true);
        expect(result.predicates).toEqual([
            expect.objectContaining({
                reaches: expect.arrayContaining([
                    expect.objectContaining({
                        scopeId: 'cte:order_scope',
                        relation: 'direct_output',
                        mode: 'rewrite_safe'
                    }),
                    expect.objectContaining({
                        scopeId: 'table:customers',
                        relation: 'join_equivalence',
                        mode: 'debug_only',
                        predicateSql: '"c"."id" = :customer_id'
                    })
                ]),
                blocked: []
            })
        ]);
        expect(result.predicates[0]!.probeTargets).toEqual(expect.arrayContaining([
            expect.objectContaining({
                scopeId: 'table:customers',
                relation: 'join_equivalence',
                mode: 'debug_only'
            })
        ]));
    });

    it('keeps LEFT JOIN nullable-side predicates blocked from preserved-side debug reachability', () => {
        const sql = `
            with order_scope as (
                select o.id, o.customer_id
                from orders o
            )
            select os.id
            from order_scope os
            left join customers c on c.id = os.customer_id
            where c.id = :customer_id
        `;

        const result = analyzePredicateReachability(sql);

        expect(result.ok).toBe(true);
        expect(result.predicates).toEqual([
            expect.objectContaining({
                reaches: expect.arrayContaining([
                    expect.objectContaining({
                        scopeId: 'scope:root',
                        relation: 'origin',
                        mode: 'rewrite_safe'
                    })
                ]),
                blocked: [
                    expect.objectContaining({
                        code: 'OUTER_JOIN_EQUIVALENCE_UNSUPPORTED',
                        relation: 'join_equivalence',
                        scopeId: 'cte:order_scope'
                    })
                ]
            })
        ]);
        expect(result.predicates[0]!.probeTargets).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                scopeId: 'cte:order_scope',
                relation: 'join_equivalence'
            })
        ]));
    });

    it('rebases JOIN-equivalence probes to CTE-local predicates when possible', () => {
        const sql = `
            with order_totals as (
                select customer_id, count(*) as order_count
                from orders
                group by customer_id
            )
            select c.id, ot.order_count
            from customers c
            join order_totals ot on ot.customer_id = c.id
            where c.id = 1000
        `;

        const result = analyzePredicateReachability(sql);

        expect(result.ok).toBe(true);
        expect(result.predicates[0]!.probeTargets).toEqual(expect.arrayContaining([
            expect.objectContaining({
                scopeId: 'cte:order_totals',
                relation: 'join_equivalence',
                mode: 'debug_only',
                predicateSql: '"ot"."customer_id" = 1000',
                targetPredicateSql: '"customer_id" = 1000'
            })
        ]));
    });

    it('keeps unsupported outer join directions as blocked debug reachability', () => {
        const sql = `
            with order_scope as (
                select o.id, o.customer_id
                from orders o
            )
            select os.id
            from customers c
            right join order_scope os on c.id = os.customer_id
            where c.id = :customer_id
        `;

        const result = analyzePredicateReachability(sql);

        expect(result.ok).toBe(true);
        expect(result.predicates).toEqual([
            expect.objectContaining({
                reaches: expect.arrayContaining([
                    expect.objectContaining({
                        scopeId: 'scope:root',
                        relation: 'origin',
                        mode: 'rewrite_safe'
                    })
                ]),
                blocked: [
                    expect.objectContaining({
                        code: 'OUTER_JOIN_EQUIVALENCE_UNSUPPORTED',
                        relation: 'join_equivalence',
                        scopeId: 'cte:order_scope'
                    })
                ]
            })
        ]);
        expect(result.predicates[0]!.probeTargets).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                scopeId: 'table:customers',
                relation: 'join_equivalence'
            })
        ]));
    });
});
