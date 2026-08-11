import { describe, expect, it } from 'vitest';
import { analyzeColumnLineage } from './columnLineageAnalysis';

describe('createInvestigationPlan', () => {
  it('keeps the complete concern set when the default symptom ranks presentation evidence', () => {
    const result = analyzeColumnLineage({
      sql: `select coalesce(sum(case when o.amount > 0 then o.amount else 0 end), 0) as total
        from orders o
        join customers c on c.customer_id = o.customer_id
        where o.status = :status
        group by c.region
        having sum(o.amount) > 0
        order by total desc
        limit 10`,
      targetColumn: 'total',
    });

    expect(result.candidateConcerns.length).toBeGreaterThan(5);
    expect(result.investigationPlan.candidateConcerns).toHaveLength(result.candidateConcerns.length);
  });

  it('reports an unbound optional parameter without marking it required', () => {
    const result = analyzeColumnLineage({
      sql: 'select o.amount from orders o',
      targetColumn: 'amount',
      parameters: {
        definitions: [{ name: 'optional_filter', origin: 'original_query_parameter', required: false }],
      },
    });

    expect(result.investigationPlan.parameters).toContainEqual(expect.objectContaining({
      name: 'optional_filter',
      required: false,
      status: 'optional',
    }));
  });
});
