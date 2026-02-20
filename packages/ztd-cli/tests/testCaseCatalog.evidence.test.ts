import { describe, expect, it } from 'vitest';
import { exportTestCaseCatalogEvidence } from './utils/testCaseCatalog';
import { alphaCatalog, emailCatalog } from './specs/testCaseCatalogs';

describe('test case catalog evidence', () => {
  it('is deterministic and sorted by catalog/case id', () => {
    const unsortedCatalogs = [emailCatalog, alphaCatalog];
    const exported1 = exportTestCaseCatalogEvidence([...unsortedCatalogs]);
    const exported2 = exportTestCaseCatalogEvidence([...unsortedCatalogs]);

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
  });
});
