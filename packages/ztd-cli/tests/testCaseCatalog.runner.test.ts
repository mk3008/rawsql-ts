import { afterAll, describe, expect } from 'vitest';
import { runTestCaseCatalog } from './utils/testCaseCatalog';
import { emailCatalog } from './specs/testCaseCatalogs';

describe('test case catalog runner', () => {
  const executedCaseIds = new Set<string>();

  runTestCaseCatalog(emailCatalog, {
    onCaseExecuted: (id) => executedCaseIds.add(id),
  });

  afterAll(() => {
    expect([...executedCaseIds].sort()).toEqual([
      'accepts-minimal-domain',
      'keeps-plus-alias',
      'keeps-valid-address',
      'rejects-invalid-input',
      'throws-empty-after-trim',
      'trims-and-lowercases',
    ]);
  });
});
