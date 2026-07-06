import { describe, expect, it } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import {
    optimizeConditions,
    planConditionOptimization
} from '../../src/transformers/ConditionOptimization';

const normalizeSql = (sql: string): string => {
    const query = SelectQueryParser.parse(sql);
    return new SqlFormatter().format(query).formattedSql;
};

const normalizeForSearch = (sql: string): string => normalizeSql(sql).replace(/\s+/g, ' ').trim().toLowerCase();

const collapseFragment = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const expectNoUnsafeConditionMove = (params: {
    sql: string;
    retainedFragments: readonly string[];
    forbiddenFragments: readonly string[];
    expectedSkippedCodes?: readonly string[];
}): void => {
    const result = optimizeConditions(params.sql);
    const normalized = normalizeForSearch(result.sql);

    expect(result.ok).toBe(true);
    expect(result.applied).toEqual([]);
    expect(normalizeSql(result.sql)).toBe(normalizeSql(params.sql));

    for (const fragment of params.retainedFragments) {
        expect(normalized).toContain(collapseFragment(fragment));
    }
    for (const fragment of params.forbiddenFragments) {
        expect(normalized).not.toContain(collapseFragment(fragment));
    }
    for (const code of params.expectedSkippedCodes ?? []) {
        expect(result.skipped.map(item => item.code)).toContain(code);
    }
};

describe('ConditionOptimization', () => {
    it('runs the SSSQL optional condition phase for SQL that only contains optional branches', () => {
        const sql = `
            select t.ticket_id, t.status
            from tickets t
            where (:status is null or t.status = :status)
        `;

        const result = planConditionOptimization(sql, {
            optionalConditionParameters: { status: null }
        });

        expect(result.ok).toBe(true);
        expect(result.phases).toEqual([
            expect.objectContaining({
                kind: 'sssql_optional_condition',
                appliedCount: 1,
                skippedCount: 0
            }),
            expect.objectContaining({
                kind: 'parameter_condition_placement',
                appliedCount: 0
            }),
            expect.objectContaining({
                kind: 'static_predicate_placement',
                appliedCount: 0
            })
        ]);
        expect(result.applied).toEqual([
            expect.objectContaining({
                phaseKind: 'sssql_optional_condition',
                kind: 'prune_optional_branch',
                parameterName: 'status'
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            select t.ticket_id, t.status
            from tickets t
        `));
    });

    it('runs parameter condition placement for SQL that only contains ordinary parameter conditions', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.customer_id
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where ob.customer_id = :customer_id
        `;

        const result = optimizeConditions(sql);

        expect(result.ok).toBe(true);
        expect(result.phases).toEqual([
            expect.objectContaining({
                kind: 'sssql_optional_condition',
                appliedCount: 0,
                skippedCount: 0
            }),
            expect.objectContaining({
                kind: 'parameter_condition_placement',
                appliedCount: 1,
                skippedCount: 0
            }),
            expect.objectContaining({
                kind: 'static_predicate_placement',
                appliedCount: 0,
                skippedCount: 0
            })
        ]);
        expect(result.applied).toEqual([
            expect.objectContaining({
                phaseKind: 'parameter_condition_placement',
                kind: 'move_condition',
                toScopeId: 'cte:orders_base'
            })
        ]);
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

    it('prunes same-block optional WHERE branches even when the query groups later', () => {
        const sql = `
            select customer_id, count(*) as order_count
            from orders
            where (:status is null or status = :status)
            group by customer_id
        `;

        const result = optimizeConditions(sql, {
            optionalConditionParameters: { status: null }
        });

        expect(result.ok).toBe(true);
        expect(result.phases[0]).toEqual(expect.objectContaining({
            kind: 'sssql_optional_condition',
            appliedCount: 1,
            skippedCount: 0
        }));
        expect(result.phases[1]).toEqual(expect.objectContaining({
            kind: 'parameter_condition_placement',
            appliedCount: 0
        }));
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            select customer_id, count(*) as order_count
            from orders
            group by customer_id
        `));
    });

    it('safely combines SSSQL pruning and ordinary parameter placement in phase order', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.customer_id, o.status
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where (:status is null or ob.status = :status)
              and ob.customer_id = :customer_id
        `;

        const result = optimizeConditions(sql, {
            optionalConditionParameters: { status: null }
        });

        expect(result.ok).toBe(true);
        expect(result.phases[0]).toEqual(expect.objectContaining({
            kind: 'sssql_optional_condition',
            appliedCount: 1
        }));
        expect(result.phases[1]).toEqual(expect.objectContaining({
            kind: 'parameter_condition_placement',
            appliedCount: 1
        }));
        expect(result.applied.map(item => item.phaseKind)).toEqual([
            'sssql_optional_condition',
            'parameter_condition_placement'
        ]);
        expect(result.phases[2]).toEqual(expect.objectContaining({
            kind: 'static_predicate_placement',
            appliedCount: 0
        }));
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with orders_base as (
                select o.order_id, o.customer_id, o.status
                from orders o
                where o.customer_id = :customer_id
            )
            select ob.order_id
            from orders_base ob
        `));
    });

    it('does not apply ordinary placement to SSSQL optional branches already handled by the SSSQL phase', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.status
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where (:status is null or ob.status = :status)
        `;

        const result = optimizeConditions(sql, {
            optionalConditionParameters: { status: 'paid' }
        });

        expect(result.ok).toBe(true);
        expect(result.phases[0]).toEqual(expect.objectContaining({
            kind: 'sssql_optional_condition',
            appliedCount: 1,
            skippedCount: 0
        }));
        expect(result.phases[1]).toEqual(expect.objectContaining({
            kind: 'parameter_condition_placement',
            appliedCount: 0,
            skippedCount: 0
        }));
        expect(result.phases[2]).toEqual(expect.objectContaining({
            kind: 'static_predicate_placement',
            appliedCount: 0,
            skippedCount: 0
        }));
        expect(result.applied).toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'sssql_optional_condition',
                kind: 'refresh_optional_branch',
                parameterName: 'status'
            })
        ]));
        expect(result.applied).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'parameter_condition_placement',
                conditionSql: expect.stringContaining(':status')
            })
        ]));
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with orders_base as (
                select o.order_id, o.status
                from orders o
                where (:status is null or o.status = :status)
            )
            select ob.order_id
            from orders_base ob
        `));
    });

    it('refreshes scalar SSSQL branches before ordinary placement when the root has a LEFT JOIN', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.customer_tier, c.region
                from customers c
            ),
            order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                group by o.customer_id
            )
            select cs.id
            from customer_scope cs
            left join order_totals ot on ot.customer_id = cs.id
            where (:customer_tier is null or cs.customer_tier = :customer_tier)
              and cs.region = :region
        `;

        const result = optimizeConditions(sql, {
            optionalConditionParameters: { customer_tier: 'gold' }
        });

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'sssql_optional_condition',
                kind: 'refresh_optional_branch',
                parameterName: 'customer_tier'
            }),
            expect.objectContaining({
                phaseKind: 'parameter_condition_placement',
                parameterNames: ['region']
            })
        ]));
        expect(result.applied).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'parameter_condition_placement',
                conditionSql: expect.stringContaining(':customer_tier')
            })
        ]));
        expect(result.phases[2]).toEqual(expect.objectContaining({
            kind: 'static_predicate_placement',
            appliedCount: 0
        }));
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with customer_scope as (
                select c.id, c.customer_tier, c.region
                from customers c
                where (:customer_tier is null or c.customer_tier = :customer_tier)
                  and c.region = :region
            ),
            order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                group by o.customer_id
            )
            select cs.id
            from customer_scope cs
            left join order_totals ot on ot.customer_id = cs.id
        `));
    });

    it('runs SSSQL, parameter, and static predicate placement in order for mixed conditions', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.customer_tier, c.region
                from customers c
            )
            select cs.id
            from customer_scope cs
            where (:customer_tier is null or cs.customer_tier = :customer_tier)
              and cs.region = :region
              and exists (
                select 1
                from customer_favorites cf
                where cf.customer_id = cs.id
                  and cf.is_active = true
              )
        `;

        const result = optimizeConditions(sql, {
            optionalConditionParameters: { customer_tier: 'gold' }
        });

        expect(result.ok).toBe(true);
        expect(result.phases.map(phase => phase.kind)).toEqual([
            'sssql_optional_condition',
            'parameter_condition_placement',
            'static_predicate_placement'
        ]);
        expect(result.phases).toEqual([
            expect.objectContaining({ kind: 'sssql_optional_condition', appliedCount: 1 }),
            expect.objectContaining({ kind: 'parameter_condition_placement', appliedCount: 1 }),
            expect.objectContaining({ kind: 'static_predicate_placement', appliedCount: 1 })
        ]);
        expect(result.applied.map(item => item.phaseKind)).toEqual([
            'sssql_optional_condition',
            'parameter_condition_placement',
            'static_predicate_placement'
        ]);
        expect(result.applied).toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'static_predicate_placement',
                kind: 'move_static_predicate',
                predicateSql: expect.stringContaining('exists'),
                columnReferences: ['cs.id']
            })
        ]));
        expect(result.applied).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'static_predicate_placement',
                predicateSql: expect.stringContaining(':region')
            }),
            expect.objectContaining({
                phaseKind: 'static_predicate_placement',
                predicateSql: expect.stringContaining(':customer_tier')
            })
        ]));
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with customer_scope as (
                select c.id, c.customer_tier, c.region
                from customers c
                where (:customer_tier is null or c.customer_tier = :customer_tier)
                  and c.region = :region
                  and exists (
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

    it('keeps unsafe static predicate skipped reasons in the unified result', () => {
        const sql = `
            with customer_scope as (
                select c.id, c.region
                from customers c
            ),
            payment_scope as (
                select p.customer_id, p.is_successful
                from payments p
            )
            select cs.id
            from customer_scope cs
            left join payment_scope ps on ps.customer_id = cs.id
            where cs.region = :region
              and ps.is_successful = true
        `;

        const result = optimizeConditions(sql);

        expect(result.ok).toBe(true);
        expect(result.phases[1]).toEqual(expect.objectContaining({
            kind: 'parameter_condition_placement',
            appliedCount: 1
        }));
        expect(result.phases[2]).toEqual(expect.objectContaining({
            kind: 'static_predicate_placement',
            appliedCount: 0,
            skippedCount: 1
        }));
        expect(result.skipped).toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'static_predicate_placement',
                code: 'OUTER_JOIN_NULLABLE_SIDE',
                skipDisposition: 'blocked'
            })
        ]));
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with customer_scope as (
                select c.id, c.region
                from customers c
                where c.region = :region
            ),
            payment_scope as (
                select p.customer_id, p.is_successful
                from payments p
            )
            select cs.id
            from customer_scope cs
            left join payment_scope ps on ps.customer_id = cs.id
            where ps.is_successful = true
        `));
    });

    it('classifies SSSQL refresh no-op as unchanged', () => {
        const sql = `
            select *
            from orders o
            where (:customer_id is null or o.customer_id = :customer_id)
        `;

        const result = optimizeConditions(sql, {
            optionalConditionParameters: { customer_id: 'C001' }
        });

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'sssql_optional_condition',
                code: 'SSSQL_OPTIONAL_REFRESH_NOOP',
                parameterName: 'customer_id',
                skipDisposition: 'unchanged'
            })
        ]));
    });

    it('classifies SSSQL optional branches without parameter input as ignored when unchanged', () => {
        const sql = `
            select *
            from orders o
            where (:customer_id is null or o.customer_id = :customer_id)
        `;

        const result = planConditionOptimization(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'sssql_optional_condition',
                parameterName: 'customer_id',
                skipDisposition: 'ignored'
            })
        ]));
    });

    it('keeps duplicate SSSQL parameter branches in UNION scopes unchanged without global refresh failure', () => {
        const sql = `
            select
                o.customer_id,
                o.order_date
            from orders o
            where (:customer_id is null or o.customer_id = :customer_id)

            union all

            select
                r.customer_id,
                r.refund_date as order_date
            from refunds r
            where (:customer_id is null or r.customer_id = :customer_id)
        `;

        const result = optimizeConditions(sql, {
            optionalConditionParameters: { customer_id: 'C001' }
        });

        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.skipped.filter(item =>
            item.phaseKind === 'sssql_optional_condition'
            && item.parameterName === 'customer_id'
        )).toHaveLength(2);
        expect(result.skipped).toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'sssql_optional_condition',
                code: 'SSSQL_OPTIONAL_REFRESH_DUPLICATE_PARAMETER_UNCHANGED',
                parameterName: 'customer_id',
                skipDisposition: 'unchanged',
                reason: expect.stringContaining('duplicate parameter')
            })
        ]));
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
    });

    it('does not propagate duplicate UNION SSSQL parameter disposition to unrelated branches', () => {
        const sql = `
            with union_source as (
                select
                    o.customer_id,
                    o.order_date
                from orders o
                where (:customer_id is null or o.customer_id = :customer_id)

                union all

                select
                    r.customer_id,
                    r.refund_date as order_date
                from refunds r
                where (:customer_id is null or r.customer_id = :customer_id)
            ),
            customer_scope as (
                select c.id, c.name
                from customers c
            )
            select *
            from union_source u
            join customer_scope c
              on c.id = u.customer_id
            where (:customer_name is null or c.name ilike '%' || :customer_name || '%')
        `;

        const result = optimizeConditions(sql, {
            optionalConditionParameters: {
                customer_id: 'C001',
                customer_name: 'alice'
            }
        });

        const customerIdSkips = result.skipped.filter(item =>
            item.phaseKind === 'sssql_optional_condition'
            && item.parameterName === 'customer_id'
        );
        const customerNameItems = [
            ...result.applied.filter(item =>
                item.phaseKind === 'sssql_optional_condition'
                && item.parameterName === 'customer_name'
            ),
            ...result.skipped.filter(item =>
                item.phaseKind === 'sssql_optional_condition'
                && item.parameterName === 'customer_name'
            )
        ];

        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
        expect(customerIdSkips).toHaveLength(2);
        expect(customerIdSkips.every(item => item.skipDisposition === 'unchanged')).toBe(true);
        expect(customerNameItems.length).toBeGreaterThan(0);
        expect(customerNameItems).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                parameterName: 'customer_name',
                reason: expect.stringContaining('customer_id')
            })
        ]));
    });

    it('preserves existing SQL comments across the integrated optimization phases', () => {
        const sql = `
            with
            -- Customer scope comment
            customer_scope as (
                select
                    c.id,
                    c.customer_tier, -- Tier projection comment
                    c.region
                from customers c
            ),
            order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                group by o.customer_id
            )
            select cs.id
            from customer_scope cs
            left join order_totals ot on ot.customer_id = cs.id
            where (:customer_tier is null or cs.customer_tier = :customer_tier)
              and cs.region = :region
        `;

        const result = optimizeConditions(sql, {
            optionalConditionParameters: { customer_tier: 'gold' }
        });

        expect(result.ok).toBe(true);
        expect(result.sql).toContain('Customer scope comment');
        expect(result.sql).toContain('Tier projection comment');
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with customer_scope as (
                select c.id, c.customer_tier, c.region
                from customers c
                where (:customer_tier is null or c.customer_tier = :customer_tier)
                  and c.region = :region
            ),
            order_totals as (
                select o.customer_id, count(*) as order_count
                from orders o
                group by o.customer_id
            )
            select cs.id
            from customer_scope cs
            left join order_totals ot on ot.customer_id = cs.id
        `));
    });

    it('keeps SQL comment compatibility when cloneInput is false for SQL input', () => {
        const sql = `
            with
            -- Customer scope comment
            customer_scope as (
                select
                    c.id,
                    c.customer_tier, -- Tier projection comment
                    c.region
                from customers c
            )
            select cs.id
            from customer_scope cs
            where (:customer_tier is null or cs.customer_tier = :customer_tier)
              and cs.region = :region
        `;

        const result = optimizeConditions(sql, {
            cloneInput: false,
            optionalConditionParameters: { customer_tier: 'gold' }
        });

        expect(result.ok).toBe(true);
        expect(result.sql).toContain('Customer scope comment');
        expect(result.sql).toContain('Tier projection comment');
    });

    it('moves grouped key predicates and reports the move in the unified result', () => {
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

        const result = optimizeConditions(sql);

        expect(result.ok).toBe(true);
        expect(result.applied).toEqual([
            expect.objectContaining({
                phaseKind: 'parameter_condition_placement',
                kind: 'move_condition',
                conditionSql: '"ot"."customer_id" = :customer_id',
                reason: expect.stringMatching(/GROUP BY key/i)
            })
        ]);
        expect(result.phases[1]).toEqual(expect.objectContaining({
            kind: 'parameter_condition_placement',
            appliedCount: 1,
            skippedCount: 0
        }));
        expect(result.phases[2]).toEqual(expect.objectContaining({
            kind: 'static_predicate_placement',
            appliedCount: 0,
            skippedCount: 0
        }));
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

    it('reports whole BETWEEN and OR moves through the integrated phases', () => {
        const sql = `
            with orders_base as (
                select o.order_id, o.order_date, o.status, o.channel
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where ob.order_date between :from_date and :to_date
              and (ob.status = 'paid' or ob.channel = 'web')
        `;

        const result = optimizeConditions(sql);

        expect(result.ok).toBe(true);
        expect(result.phases[1]).toEqual(expect.objectContaining({
            kind: 'parameter_condition_placement',
            appliedCount: 1,
            skippedCount: 0
        }));
        expect(result.phases[2]).toEqual(expect.objectContaining({
            kind: 'static_predicate_placement',
            appliedCount: 1,
            skippedCount: 0
        }));
        expect(result.applied).toEqual([
            expect.objectContaining({
                phaseKind: 'parameter_condition_placement',
                conditionSql: '"ob"."order_date" between :from_date and :to_date'
            }),
            expect.objectContaining({
                phaseKind: 'static_predicate_placement',
                predicateSql: `("ob"."status" = 'paid' or "ob"."channel" = 'web')`
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(`
            with orders_base as (
                select o.order_id, o.order_date, o.status, o.channel
                from orders o
                where o.order_date between :from_date and :to_date
                  and (o.status = 'paid' or o.channel = 'web')
            )
            select ob.order_id
            from orders_base ob
        `));
    });

    it('runs the later phase even when the SSSQL phase is a no-op', () => {
        const sql = `
            with customers_base as (
                select c.customer_id, c.tier
                from customers c
            )
            select cb.customer_id
            from customers_base cb
            where cb.tier = :tier
        `;

        const result = planConditionOptimization(sql);

        expect(result.ok).toBe(true);
        expect(result.phases[0]).toEqual(expect.objectContaining({
            kind: 'sssql_optional_condition',
            appliedCount: 0,
            skippedCount: 0
        }));
        expect(result.phases[1]).toEqual(expect.objectContaining({
            kind: 'parameter_condition_placement',
            appliedCount: 1
        }));
        expect(result.phases[2]).toEqual(expect.objectContaining({
            kind: 'static_predicate_placement',
            appliedCount: 0
        }));
        expect(normalizeSql(result.sql)).toContain('where "c"."tier" = :tier');
    });

    it('aggregates phase warnings and errors into the unified result', () => {
        const query = SelectQueryParser.parse(`
            with customers_base as (
                select c.customer_id, c.tier
                from customers c
            )
            select cb.customer_id
            from customers_base cb
            where cb.tier = :tier
        `);

        const warningResult = planConditionOptimization(query);

        expect(warningResult.ok).toBe(true);
        expect(warningResult.warnings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                phaseKind: 'sssql_optional_condition',
                code: 'AST_INPUT_FORMATTED'
            })
        ]));
        expect(warningResult.phases[0]).toEqual(expect.objectContaining({
            warningCount: 1,
            errorCount: 0
        }));
        expect(warningResult.phases[2]).toEqual(expect.objectContaining({
            kind: 'static_predicate_placement'
        }));

        const errorResult = planConditionOptimization('select from');

        expect(errorResult.ok).toBe(false);
        expect(errorResult.errors.length).toBeGreaterThan(0);
        expect(errorResult.phases.some(phase => phase.errorCount > 0)).toBe(true);
    });

    it('returns a dry-run plan without mutating caller-owned AST input', () => {
        const query = SelectQueryParser.parse(`
            with orders_base as (
                select o.order_id, o.customer_id, o.status
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where (:status is null or ob.status = :status)
              and ob.customer_id = :customer_id
        `);
        const before = new SqlFormatter().format(query).formattedSql;

        const result = optimizeConditions(query, {
            dryRun: true,
            optionalConditionParameters: { status: null }
        });

        expect(result.ok).toBe(true);
        expect(result.safety).toEqual(expect.objectContaining({
            mode: 'safe_only',
            unsafeRewriteApplied: false,
            dryRun: true
        }));
        expect(result.applied).toHaveLength(2);
        expect(new SqlFormatter().format(query).formattedSql).toBe(before);
        expect(normalizeSql(result.sql)).not.toBe(before);
    });

    it('returns the final optimized query model and applies caller format options to SQL output', () => {
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

        const result = optimizeConditions(sql, { formatOptions });

        expect(result.ok).toBe(true);
        expect(result.query).not.toBeNull();
        expect(result.sql).toBe(new SqlFormatter(formatOptions).format(result.query!).formattedSql);
        expect(result.sql).toContain('WITH orders_base AS');
        expect(result.sql).toContain('WHERE o.customer_id = :customer_id');
    });

    it('can reuse caller-owned AST input without formatter cloning when explicitly requested', () => {
        const query = SelectQueryParser.parse(`
            with orders_base as (
                select o.order_id, o.customer_id, o.status
                from orders o
            )
            select ob.order_id
            from orders_base ob
            where (:status is null or ob.status = :status)
              and ob.customer_id = :customer_id
        `);

        const result = optimizeConditions(query, {
            cloneInput: false,
            optionalConditionParameters: { status: null }
        });

        expect(result.ok).toBe(true);
        expect(result.query).toBe(query);
        expect(result.safety.formatterGeneratedSource).toBe(false);
        expect(result.warnings).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'AST_INPUT_FORMATTED' })
        ]));
        expect(normalizeSql(result.sql)).toContain('where "o"."customer_id" = :customer_id');
    });

    describe('unsafe condition movement boundaries', () => {
        it('does not push a predicate through ORDER BY plus LIMIT', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with recent_orders as (
                        select
                            id,
                            customer_id,
                            created_at
                        from orders
                        order by created_at desc
                        limit 100
                    )
                    select *
                    from recent_orders
                    where customer_id = :customer_id
                `,
                retainedFragments: [
                    'from "recent_orders" where "customer_id" = :customer_id'
                ],
                forbiddenFragments: [
                    'from "orders" where "customer_id" = :customer_id'
                ],
                expectedSkippedCodes: ['ROW_LIMIT_BOUNDARY']
            });
        });

        it('does not push a predicate through DISTINCT ON', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with latest_order as (
                        select distinct on (customer_id)
                            customer_id,
                            status,
                            created_at
                        from orders
                        order by customer_id, created_at desc
                    )
                    select *
                    from latest_order
                    where status = 'paid'
                `,
                retainedFragments: [
                    'from "latest_order" where "status" = \'paid\''
                ],
                forbiddenFragments: [
                    'from "orders" where "status" = \'paid\''
                ],
                expectedSkippedCodes: ['DISTINCT_BOUNDARY']
            });
        });

        it('does not push a predicate before window function calculation', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with ranked_orders as (
                        select
                            id,
                            customer_id,
                            amount,
                            created_at,
                            row_number() over (
                                partition by customer_id
                                order by created_at desc
                            ) as rn
                        from orders
                    )
                    select *
                    from ranked_orders
                    where rn = 1
                      and amount >= :min_amount
                `,
                retainedFragments: [
                    'from "ranked_orders" where "rn" = 1 and "amount" >= :min_amount'
                ],
                forbiddenFragments: [
                    'from "orders" where "amount" >= :min_amount',
                    'from "orders" where "rn" = 1'
                ],
                expectedSkippedCodes: ['WINDOW_BOUNDARY']
            });
        });

        it('does not push an aggregate alias predicate into pre-aggregation WHERE or HAVING', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with customer_summary as (
                        select
                            c.id as customer_id,
                            count(o.id) as order_count,
                            sum(o.amount) as total_amount
                        from customers c
                        left join orders o on o.customer_id = c.id
                        group by c.id
                    )
                    select *
                    from customer_summary
                    where order_count >= 3
                `,
                retainedFragments: [
                    'from "customer_summary" where "order_count" >= 3'
                ],
                forbiddenFragments: [
                    'where "order_count" >= 3 group by',
                    'having count("o"."id") >= 3'
                ],
                expectedSkippedCodes: ['EXPRESSION_OUTPUT_UNSUPPORTED']
            });
        });

        it('does not move a LEFT JOIN nullable-side predicate into JOIN ON', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with customer_orders as (
                        select
                            c.id as customer_id,
                            o.id as order_id,
                            o.status as order_status
                        from customers c
                        left join orders o on o.customer_id = c.id
                    )
                    select *
                    from customer_orders
                    where order_status = 'paid'
                `,
                retainedFragments: [
                    'from "customer_orders" where "order_status" = \'paid\''
                ],
                forbiddenFragments: [
                    'on "o"."customer_id" = "c"."id" and "o"."status" = \'paid\'',
                    'from "customers" as "c" left join "orders" as "o" on "o"."customer_id" = "c"."id" where "o"."status" = \'paid\''
                ],
                expectedSkippedCodes: ['OUTER_JOIN_BOUNDARY']
            });
        });

        it('does not move a LEFT JOIN anti-join NULL predicate into JOIN ON', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with customer_orders as (
                        select
                            c.id as customer_id,
                            o.id as order_id
                        from customers c
                        left join orders o on o.customer_id = c.id
                    )
                    select *
                    from customer_orders
                    where order_id is null
                `,
                retainedFragments: [
                    'from "customer_orders" where "order_id" is null'
                ],
                forbiddenFragments: [
                    'on "o"."customer_id" = "c"."id" and "o"."id" is null'
                ],
                expectedSkippedCodes: ['OUTER_JOIN_BOUNDARY']
            });
        });

        it('does not split an OR predicate and push down only one branch', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with customer_summary as (
                        select
                            customer_id,
                            sum(amount) as total_amount
                        from some_summary
                        group by customer_id
                    )
                    select *
                    from customer_summary
                    where customer_id = :customer_id
                       or total_amount >= :min_total_amount
                `,
                retainedFragments: [
                    'from "customer_summary" where "customer_id" = :customer_id or "total_amount" >= :min_total_amount'
                ],
                forbiddenFragments: [
                    'from "some_summary" where "customer_id" = :customer_id',
                    'where sum("amount") >= :min_total_amount',
                    'having sum("amount") >= :min_total_amount'
                ],
                expectedSkippedCodes: ['EXPRESSION_OUTPUT_UNSUPPORTED']
            });
        });

        it('does not reverse a CASE alias predicate into source predicates', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with user_status as (
                        select
                            id,
                            case
                                when deleted_at is not null then 'inactive'
                                when banned_at is not null then 'inactive'
                                else 'active'
                            end as status_label
                        from users
                    )
                    select *
                    from user_status
                    where status_label = 'inactive'
                `,
                retainedFragments: [
                    'from "user_status" where "status_label" = \'inactive\''
                ],
                forbiddenFragments: [
                    'from "users" where'
                ],
                expectedSkippedCodes: ['EXPRESSION_OUTPUT_UNSUPPORTED']
            });
        });

        it('does not inline a volatile expression alias predicate', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with sampled_users as (
                        select
                            id,
                            random() as r
                        from users
                    )
                    select *
                    from sampled_users
                    where r < 0.1
                `,
                retainedFragments: [
                    'from "sampled_users" where "r" < 0.1'
                ],
                forbiddenFragments: [
                    'from "users" where random() < 0.1'
                ],
                expectedSkippedCodes: ['EXPRESSION_OUTPUT_UNSUPPORTED']
            });
        });

        it('pushes predicates into UNION ALL branches by output position', () => {
            const result = optimizeConditions(`
                with activities as (
                    select
                        customer_id,
                        created_at,
                        'order' as activity_type
                    from orders

                    union all

                    select
                        recipient_id as customer_id,
                        sent_at as created_at,
                        'email' as activity_type
                    from emails
                )
                select *
                from activities
                where customer_id = :customer_id
                  and created_at >= :from_date
            `);

            expect(result.ok).toBe(true);
            expect(result.applied).toEqual([
                expect.objectContaining({
                    kind: 'move_condition',
                    conditionSql: '"customer_id" = :customer_id',
                    reason: expect.stringMatching(/output column position/i)
                }),
                expect.objectContaining({
                    kind: 'move_condition',
                    conditionSql: '"created_at" >= :from_date',
                    reason: expect.stringMatching(/output column position/i)
                })
            ]);
            expect(result.skipped).toEqual([]);
            expect(normalizeSql(result.sql)).toBe(normalizeSql(`
                with activities as (
                    select
                        customer_id,
                        created_at,
                        'order' as activity_type
                    from orders
                    where customer_id = :customer_id
                      and created_at >= :from_date

                    union all

                    select
                        recipient_id as customer_id,
                        sent_at as created_at,
                        'email' as activity_type
                    from emails
                    where recipient_id = :customer_id
                      and sent_at >= :from_date
                )
                select *
                from activities
            `));
        });

        it('does not push a predicate into recursive CTE anchor or recursive branches', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with recursive category_tree as (
                        select
                            id,
                            parent_id,
                            name
                        from categories
                        where id = :root_id

                        union all

                        select
                            c.id,
                            c.parent_id,
                            c.name
                        from categories c
                        join category_tree t on c.parent_id = t.id
                    )
                    select *
                    from category_tree
                    where id = :target_id
                `,
                retainedFragments: [
                    'from "category_tree" where "id" = :target_id'
                ],
                forbiddenFragments: [
                    'where "id" = :root_id and "id" = :target_id',
                    'from "categories" as "c" where "c"."id" = :target_id'
                ],
                expectedSkippedCodes: ['CTE_REUSE_UNSUPPORTED']
            });
        });

        it('does not push a predicate into a data-modifying CTE with RETURNING', () => {
            expectNoUnsafeConditionMove({
                sql: `
                    with updated_orders as (
                        update orders
                        set checked = true
                        where status = 'pending'
                        returning id, customer_id, status
                    )
                    select *
                    from updated_orders
                    where customer_id = :customer_id
                `,
                retainedFragments: [
                    'from "updated_orders" where "customer_id" = :customer_id'
                ],
                forbiddenFragments: [
                    'where "status" = \'pending\' and "customer_id" = :customer_id',
                    'returning "id", "customer_id", "status" where'
                ]
            });
        });
    });
});
