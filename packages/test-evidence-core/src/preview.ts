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
    validateCatalogRefs(catalog.refs, `${side}.sqlCaseCatalogs[${catalogIndex}].refs`);
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
    validateCatalogRefs(catalog.refs, `${side}.testCaseCatalogs[${catalogIndex}].refs`);
    if (!Array.isArray(catalog.cases)) {
      throw invalidInput(`${side}.testCaseCatalogs[${catalogIndex}].cases`, 'must be an array');
    }
    for (const [caseIndex, testCase] of catalog.cases.entries()) {
      if (!isPlainObject(testCase)) {
        throw invalidInput(`${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}]`, 'must be an object');
      }
      assertNonEmptyString(testCase.id, `${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].id`);
      assertNonEmptyString(testCase.title, `${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].title`);
      const expectedPath = `${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].expected`;
      if (testCase.expected !== 'success' && testCase.expected !== 'throws' && testCase.expected !== 'errorResult') {
        throw invalidInput(expectedPath, 'must be "success", "throws", or "errorResult"');
      }
      if (testCase.expected === 'throws') {
        if (!isPlainObject(testCase.error)) {
          throw invalidInput(`${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].error`, 'must be an object');
        }
        assertNonEmptyString(testCase.error.name, `${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].error.name`);
        assertNonEmptyString(testCase.error.message, `${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].error.message`);
        if (testCase.error.match !== 'equals' && testCase.error.match !== 'contains') {
          throw invalidInput(
            `${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].error.match`,
            'must be "equals" or "contains"'
          );
        }
      } else if (!Object.prototype.hasOwnProperty.call(testCase, 'output')) {
        throw invalidInput(`${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].output`, 'must be provided');
      }
      if (Object.prototype.hasOwnProperty.call(testCase, 'tags')) {
        if (!Array.isArray(testCase.tags) || testCase.tags.some((tag: unknown) => typeof tag !== 'string' || tag.trim().length === 0)) {
          throw invalidInput(`${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].tags`, 'must be an array of non-empty strings');
        }
      }
      if (Object.prototype.hasOwnProperty.call(testCase, 'focus')) {
        assertNonEmptyString(testCase.focus, `${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].focus`);
      }
      validateCatalogRefs(testCase.refs, `${side}.testCaseCatalogs[${catalogIndex}].cases[${caseIndex}].refs`);
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
    ...(Array.isArray(catalog.refs) && catalog.refs.length > 0
      ? { refs: [...catalog.refs].map((ref) => ({ label: ref.label.trim(), url: ref.url.trim() }))
          .sort((a, b) => a.label.localeCompare(b.label) || a.url.localeCompare(b.url)) }
      : {}),
    fixtures: [...(catalog.fixtures ?? []).map((item) => item.tableName)].sort((a, b) => a.localeCompare(b)),
    cases: catalog.cases.map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      input: testCase.params,
      expected: 'success',
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
    ...(Array.isArray(catalog.refs) && catalog.refs.length > 0
      ? { refs: [...catalog.refs].map((ref) => ({ label: ref.label.trim(), url: ref.url.trim() }))
          .sort((a, b) => a.label.localeCompare(b.label) || a.url.localeCompare(b.url)) }
      : {}),
    cases: catalog.cases.map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      input: testCase.input,
      expected: testCase.expected,
      ...(testCase.expected === 'throws' ? { error: testCase.error } : { output: testCase.output }),
      ...(Array.isArray(testCase.tags) && testCase.tags.length > 0
        ? { tags: [...testCase.tags] }
        : {}),
      ...(typeof testCase.focus === 'string' && testCase.focus.trim().length > 0
        ? { focus: testCase.focus.trim() }
        : {}),
      ...(Array.isArray(testCase.refs) && testCase.refs.length > 0
        ? { refs: [...testCase.refs].map((ref) => ({ label: ref.label.trim(), url: ref.url.trim() }))
            .sort((a, b) => a.label.localeCompare(b.label) || a.url.localeCompare(b.url)) }
        : {})
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

function validateCatalogRefs(value: unknown, path: string): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    throw invalidInput(path, 'must be an array');
  }
  for (const [index, item] of value.entries()) {
    if (!isPlainObject(item)) {
      throw invalidInput(`${path}[${index}]`, 'must be an object');
    }
    assertNonEmptyString(item.label, `${path}[${index}].label`);
    assertNonEmptyString(item.url, `${path}[${index}].url`);
  }
}
