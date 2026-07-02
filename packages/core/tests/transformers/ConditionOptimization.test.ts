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

    it('keeps unsafe, ambiguous, and unsupported placement skips in the unified result', () => {
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
        expect(result.applied).toEqual([]);
        expect(result.phases[1]).toEqual(expect.objectContaining({
            kind: 'parameter_condition_placement',
            appliedCount: 0,
            skippedCount: 1
        }));
        expect(result.skipped).toEqual([
            expect.objectContaining({
                phaseKind: 'parameter_condition_placement',
                reason: expect.stringMatching(/group by/i)
            })
        ]);
        expect(normalizeSql(result.sql)).toBe(normalizeSql(sql));
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
});
