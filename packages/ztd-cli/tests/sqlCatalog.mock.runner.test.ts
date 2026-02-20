import { afterAll, describe, expect } from 'vitest';
import { runSqlCatalog } from './utils/sqlCatalog';
import { sampleSqlCatalog } from './specs/sql/sample';

describe('sql catalog runner (mock)', () => {
  const executedCaseIds = new Set<string>();

  runSqlCatalog(sampleSqlCatalog, {
    executor: createMockSampleExecutor(),
    onCaseExecuted: (id) => executedCaseIds.add(id),
  });

  afterAll(() => {
    expect([...executedCaseIds].sort()).toEqual([
      'returns-active-users',
      'returns-inactive-users-when-active-0',
    ]);
  });
});

function createMockSampleExecutor() {
  return async (_sql: string, params: Record<string, unknown>) => {
    return params.active === 0 ? [{ id: 2 }] : [{ id: 1 }];
  };
}
