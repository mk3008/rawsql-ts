/**
 * Normalize SQL-driver timestamp payloads into `Date`.
 *
 * This helper intentionally lives in the generated project so the scaffold
 * does not depend on optional sql-contract utility exports.
 */
export function normalizeTimestamp(value: unknown, fieldName?: string): Date {
  const fieldLabel = fieldName ? ` for "${fieldName}"` : '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid Date instance${fieldLabel}.`);
    }
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error(`Expected a non-empty timestamp string${fieldLabel}.`);
    }
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid timestamp string${fieldLabel}: "${value}".`);
    }
    return new Date(parsed);
  }

  const actualType = value === null ? 'null' : typeof value;
  throw new Error(`Expected Date or timestamp string${fieldLabel}, received ${actualType}.`);
}
