// Runtime coercions run BEFORE validator schemas.
// See docs/recipes/mapping-vs-validation.md for pipeline details.
export function normalizeTimestamp(value: unknown, fieldName?: string): Date {
  const fieldLabel = fieldName?.trim() ? ` for "${fieldName}"` : '';

  // Preserve valid Date instances while rejecting invalid dates eagerly.
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid Date value${fieldLabel}.`);
    }
    return value;
  }

  // Parse driver-returned timestamp strings after trimming transport whitespace.
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(`Expected a non-empty timestamp string${fieldLabel}.`);
    }

    const timestamp = Date.parse(trimmed);
    if (Number.isNaN(timestamp)) {
      throw new Error(`Invalid timestamp string${fieldLabel}: "${value}".`);
    }
    return new Date(timestamp);
  }

  const actualType = value === null ? 'null' : typeof value;
  throw new Error(`Expected Date or timestamp string${fieldLabel}, received ${actualType}.`);
}
