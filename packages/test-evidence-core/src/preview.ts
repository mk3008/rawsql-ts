import { DiffCatalog, DiffCoreError, PREVIEW_SCHEMA_VERSION, type PreviewJson } from './types';

/**
 * Validate PreviewJson shape with deterministic, typed failures.
 */
export function validatePreviewJson(value: unknown, side: 'base' | 'head' | 'preview'): PreviewJson {
  if (!isPlainObject(value)) {
    throw invalidInput(`${side}`, 'must be an object');
  }

  const schemaVersionRaw = value.schemaVersion;
  if (typeof schemaVersionRaw !== 'number' || !Number.isInteger(schemaVersionRaw) || schemaVersionRaw < 1) {
    throw invalidInput(`${side}.schemaVersion`, 'must be a positive integer');
  }
  if (schemaVersionRaw !== PREVIEW_SCHEMA_VERSION) {
    throw new DiffCoreError(
      `${side}.schemaVersion ${schemaVersionRaw} is unsupported. Supported major version: ${PREVIEW_SCHEMA_VERSION}.`,
      {
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        path: `${side}.schemaVersion`,
        schemaVersion: schemaVersionRaw
      }
    );
  }

  if (!Array.isArray(value.sqlCaseCatalogs)) {
    throw invalidInput(`${side}.sqlCaseCatalogs`, 'must be an array');
  }
  if (!Array.isArray(value.testCaseCatalogs)) {
    throw invalidInput(`${side}.testCaseCatalogs`, 'must be an array');
  }

  for (const [catalogIndex, catalog] of value.sqlCaseCatalogs.entries()) {
    if (!isPlainObject(catalog)) {
      throw invalidInput(`${side}.sqlCaseCatalogs[${catalogIndex}]`, 'must be an object');
    }
    assertNonEmptyString(catalog.id, `${side}.sqlCaseCatalogs[${catalogIndex}].id`);
    assertNonEmptyString(catalog.title, `${side}.sqlCaseCatalogs[${catalogIndex}].title`);
    if (!Array.isArray(catalog.cases)) {
      throw invalidInput(`${side}.sqlCaseCatalogs[${catalogIndex}].cases`, 'must be an array');
    }
    for (const [caseIndex, testCase] of catalog.cases.entries()) {
      if (!isPlainObject(testCase)) {
        throw invalidInput(`${side}.sqlCaseCatalogs[${catalogIndex}].cases[${caseIndex}]`, 'must be an object');
      }
      assertNonEmptyString(testCase.id, `${side}.sqlCaseCatalogs[${catalogIndex}].cases[${caseIndex}].id`);
      assertNonEmptyString(testCase.title, `${side}.sqlCaseCatalogs[${catalogIndex}].cases[${caseIndex}].title`);
    }
  }

  for (const [catalogIndex, catalog] of value.testCaseCatalogs.entries()) {
    if (!isPlainObject(catalog)) {
      throw invalidInput(`${side}.testCaseCatalogs[${catalogIndex}]`, 'must be an object');
    }
    assertNonEmptyString(catalog.id, `${side}.testCaseCatalogs[${catalogIndex}].id`);
    assertNonEmptyString(catalog.title, `${side}.testCaseCatalogs[${catalogIndex}].title`);
    if (!Array.isArray(catalog.cases)) {
      throw invalidInput(`${side}.testCaseCatalogs[${catalogIndex}].cases`, 'must be an array');
    }
    for (const [caseIndex, testCase] of catalog.cases.entries()) {
      if (!isPlainObject(testCase)) {
        throw invalidInput(`${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}]`, 'must be an object');
      }
      assertNonEmptyString(testCase.id, `${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].id`);
      assertNonEmptyString(testCase.title, `${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].title`);
    }
  }

  return value as PreviewJson;
}

/**
 * Normalize PreviewJson catalogs into deterministic diff catalogs.
 */
export function normalizeCatalogsForDiff(report: PreviewJson): DiffCatalog[] {
  const sqlCatalogs: DiffCatalog[] = report.sqlCaseCatalogs.map((catalog) => ({
    kind: 'sql',
    catalogId: catalog.id,
    title: catalog.title,
    ...(typeof catalog.description === 'string' && catalog.description.trim().length > 0
      ? { description: catalog.description.trim() }
      : {}),
    definition: catalog.definitionPath,
    fixtures: [...(catalog.fixtures ?? []).map((item) => item.tableName)].sort((a, b) => a.localeCompare(b)),
    cases: catalog.cases.map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      input: testCase.params,
      output: testCase.expected
    }))
  }));

  const functionCatalogs: DiffCatalog[] = report.testCaseCatalogs.map((catalog) => ({
    kind: 'function',
    catalogId: catalog.id,
    title: catalog.title,
    ...(typeof catalog.description === 'string' && catalog.description.trim().length > 0
      ? { description: catalog.description.trim() }
      : {}),
    definition: catalog.definitionPath,
    cases: catalog.cases.map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      input: testCase.input,
      output: testCase.output
    }))
  }));

  return [...sqlCatalogs, ...functionCatalogs].sort((a, b) => a.catalogId.localeCompare(b.catalogId));
}

function invalidInput(path: string, details: string): DiffCoreError {
  return new DiffCoreError(`${path} ${details}.`, {
    code: 'INVALID_INPUT',
    path,
    details
  });
}

function assertNonEmptyString(value: unknown, path: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidInput(path, 'must be a non-empty string');
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
