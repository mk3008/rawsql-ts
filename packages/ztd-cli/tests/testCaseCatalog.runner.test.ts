import { afterAll, describe, expect } from 'vitest';
import {
  defineTestCaseCatalog,
  exportTestCaseCatalogEvidence,
  runTestCaseCatalog,
} from './utils/testCaseCatalog';

function normalizeEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed.includes('@')) {
    throw new Error('invalid email');
  }
  return trimmed;
}

describe('test case catalog runner', () => {
  const executedCaseIds = new Set<string>();
  const emailCatalog = defineTestCaseCatalog({
    id: 'unit.normalize-email',
    title: 'normalizeEmail',
    description: 'Executable, inference-free specification for internal normalization behavior.',
    cases: [
      {
        id: 'rejects-invalid-input',
        title: 'throws when @ is missing',
        arrange: () => 'invalid-email',
        act: (value) => () => normalizeEmail(value),
        assert: (invoke) => {
          expect(() => invoke()).toThrow('invalid email');
        },
      },
      {
        id: 'trims-and-lowercases',
        title: 'normalizes uppercase + spaces',
        arrange: () => '  USER@Example.COM ',
        act: (value) => () => normalizeEmail(value),
        assert: (invoke) => {
          expect(invoke()).toBe('user@example.com');
        },
      },
      {
        id: 'keeps-valid-address',
        title: 'retains already-normalized email',
        arrange: () => 'alice@example.com',
        act: (value) => () => normalizeEmail(value),
        assert: (invoke) => {
          expect(invoke()).toBe('alice@example.com');
        },
      },
    ],
  });
  const alphaCatalog = defineTestCaseCatalog({
    id: 'unit.alpha',
    title: 'alpha',
    cases: [
      {
        id: 'a',
        title: 'noop',
        arrange: () => 1,
        act: (value) => () => value,
        assert: (invoke) => {
          expect(invoke()).toBe(1);
        },
      },
    ],
  });

  runTestCaseCatalog(emailCatalog, {
    onCaseExecuted: (id) => executedCaseIds.add(id),
  });

  afterAll(() => {
    expect([...executedCaseIds].sort()).toEqual([
      'keeps-valid-address',
      'rejects-invalid-input',
      'trims-and-lowercases',
    ]);
  });

  describe('evidence export', () => {
    const buildEvidencePair = () => () => {
      const unsortedCatalogs = [emailCatalog, alphaCatalog].reverse();
      const exported1 = exportTestCaseCatalogEvidence([...unsortedCatalogs]);
      const exported2 = exportTestCaseCatalogEvidence([...unsortedCatalogs]);
      return { exported1, exported2 };
    };

    runTestCaseCatalog(
      defineTestCaseCatalog({
        id: 'unit.evidence',
        title: 'deterministic export checks',
        cases: [
          {
            id: 'stable-ordering',
            title: 'sorts catalogs/cases and stays deterministic',
            act: () => buildEvidencePair(),
            assert: (invoke) => {
              const { exported1, exported2 } = invoke();
              expect(exported1).toEqual(exported2);
              expect(exported1.catalogs.map((catalog) => catalog.id)).toEqual([
                'unit.alpha',
                'unit.normalize-email',
              ]);
              const normalize = exported1.catalogs.find(
                (catalog) => catalog.id === 'unit.normalize-email'
              );
              expect(normalize).toBeDefined();
              expect(normalize!.cases.map((item) => item.id)).toEqual([
                'keeps-valid-address',
                'rejects-invalid-input',
                'trims-and-lowercases',
              ]);
            },
          },
        ],
      })
    );
  });
});
