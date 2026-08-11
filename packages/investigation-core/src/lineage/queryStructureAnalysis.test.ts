import { describe, expect, it } from 'vitest';
import { analyzeQueryStructure } from './queryStructureAnalysis';

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
        maximumNestingDepth: expect.any(Number),
        outputColumnCount: 2,
        physicalTableCount: 1,
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
  });
});
