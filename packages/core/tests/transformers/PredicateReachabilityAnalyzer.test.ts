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

    it('keeps OUTER JOIN equivalence as blocked debug reachability instead of treating it as a rewrite target', () => {
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
                    })
                ]),
                blocked: [
                    expect.objectContaining({
                        code: 'OUTER_JOIN_EQUIVALENCE_UNSUPPORTED',
                        relation: 'join_equivalence',
                        scopeId: 'table:customers'
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
