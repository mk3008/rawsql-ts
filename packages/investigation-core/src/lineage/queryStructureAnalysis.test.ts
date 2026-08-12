import { describe, expect, it } from 'vitest';
import { analyzeQueryStructure } from './queryStructureAnalysis';
import { analyzeSql } from './rawsqlAdapter';

describe('analyzeQueryStructure', () => {
  it('summarizes query components, nesting, and row-set operations without choosing a column', () => {
    const result = analyzeQueryStructure({
      sql: `with active_orders as (
        select o.customer_id, o.amount
        from orders o
        where o.status = :status
      )
      select customer_id, sum(amount) as total_amount
      from active_orders
      group by customer_id
      having sum(amount) > 0
      order by total_amount desc
      limit 10`,
    });

    expect(result).toMatchObject({
      analysisMode: 'original',
      kind: 'query-structure-analysis',
      summary: {
        cteCount: 1,
        derivedQueryCount: 0,
        maximumNestingDepth: 2,
        outputColumnCount: 2,
        physicalTableCount: 1,
        scopeCount: 2,
      },
    });
    expect(result.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'cte', label: 'active_orders' }),
      expect.objectContaining({ kind: 'table', label: 'orders' }),
    ]));
    expect(result.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'where', effects: ['may_filter_rows'] }),
      expect.objectContaining({ kind: 'group_by', effects: expect.arrayContaining(['may_change_grain']) }),
      expect.objectContaining({ kind: 'having', effects: ['may_filter_rows'] }),
      expect.objectContaining({ kind: 'order_by', effects: ['may_change_order'] }),
      expect.objectContaining({ kind: 'limit', effects: ['may_limit_rows'] }),
    ]));
    expect(result.scopes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        directCteNames: ['active_orders'],
        outerReferenceStatus: 'none',
        scopeKind: 'root',
        selector: { path: [{ kind: 'root' }], version: 1 },
      }),
      expect.objectContaining({
        scopeKind: 'cte',
        selector: {
          path: [{ kind: 'root' }, { index: 0, kind: 'cte', name: 'active_orders' }],
          version: 1,
        },
      }),
    ]));
  });

  it('includes correlated predicate scopes in the full structural inventory', () => {
    const result = analyzeQueryStructure({
      sql: `select *
        from orders o
        where exists (
          select 1
          from payments p
          where p.order_id = o.order_id
        )`,
    });
    const exists = result.scopes.find((scope) => scope.scopeKind === 'exists');

    expect(exists).toMatchObject({
      outerReferenceStatus: 'correlated',
      parentSelector: { path: [{ kind: 'root' }], version: 1 },
      scopeKind: 'exists',
      selector: {
        path: [
          { kind: 'root' },
          {
            clause: 'where',
            index: 0,
            kind: 'expression_subquery',
            subqueryKind: 'exists',
          },
        ],
        version: 1,
      },
    });
    expect(result.summary.scopeCount).toBe(2);
    expect(result.summary.maximumNestingDepth).toBe(2);
  });

  it('preserves every existing lineage scope id while adding structural selectors', () => {
    const sql = `with base as (select id from orders)
      select (select max(amount) from payments) as amount
      from (select id from base) nested
      union all
      select 0 from archived_orders`;
    const legacyIds = analyzeSql(sql, { analysisMode: 'original', optimizeConditions: false })
      .lineage.scopes.map((scope) => scope.id);
    const structureIds = analyzeQueryStructure({ sql }).scopes.map((scope) => scope.id);

    expect(structureIds.filter((id) => legacyIds.includes(id))).toEqual(legacyIds);
    expect(new Set(structureIds).size).toBe(structureIds.length);
  });
});
