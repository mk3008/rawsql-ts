import { normalizeCatalogsForDiff, validatePreviewJson } from './preview';
import { PREVIEW_SCHEMA_VERSION, type PreviewJson, type SpecificationModel } from './types';

/**
 * Build a deterministic, pure intermediate model from PreviewJson.
 */
export function buildSpecificationModel(previewJson: PreviewJson): SpecificationModel {
  const preview = validatePreviewJson(previewJson, 'preview');
  const catalogs = normalizeCatalogsForDiff(preview);
  const sqlCatalogs = catalogs.filter((catalog) => catalog.kind === 'sql').length;
  const functionCatalogs = catalogs.filter((catalog) => catalog.kind === 'function').length;
  const tests = catalogs.reduce((count, catalog) => count + catalog.cases.length, 0);

  return {
    schemaVersion: PREVIEW_SCHEMA_VERSION,
    totals: {
      catalogs: catalogs.length,
      sqlCatalogs,
      functionCatalogs,
      tests
    },
    catalogs
  };
}
