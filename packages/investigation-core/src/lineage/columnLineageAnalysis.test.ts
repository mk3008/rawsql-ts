import { describe, expect, it } from 'vitest';
import type { ColumnLineageAnalysisV1 } from '../index';
import { analyzeColumnLineage } from './columnLineageAnalysis';

describe('analyzeColumnLineage', () => {
  it('returns the selected column lineage together with its static investigation plan', () => {
    const result = analyzeColumnLineage({
      sql: 'select sum(o.amount) as total_amount from orders o where o.status = :status',
      targetColumn: 'total_amount',
    });
    const typedResult: ColumnLineageAnalysisV1 = result;
    const version: 1 = typedResult.version;

    expect(result).toMatchObject({
      analysisMode: 'original',
      kind: 'column-lineage-analysis',
      target: { columnName: 'total_amount', nodeId: 'main_output' },
      investigationPlan: { kind: 'investigation-plan', target: { columnName: 'total_amount', nodeId: 'main_output' } },
    });
    expect(version).toBe(1);
    expect(result.columnLineage.sourceLeaves).toEqual(expect.arrayContaining([
      expect.objectContaining({ columnName: 'amount', nodeId: 'table_orders' }),
    ]));
    expect(result.rowLineage.influences).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'where', mechanism: 'where' }),
    ]));
  });

  it('requires a unique final output-column name instead of accepting an internal target id', () => {
    expect(() => analyzeColumnLineage({
      sql: 'select 1 as repeated, 2 as repeated',
      targetColumn: 'repeated',
    })).toThrow(expect.objectContaining({ code: 'DUPLICATE_OUTPUT_COLUMN' }));
  });
});
