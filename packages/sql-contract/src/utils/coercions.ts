/**
 * Attempts to parse a numeric string into a JavaScript number while making the
 * unsafe precision loss explicit in the API name.
 *
 * This helper leaves non-string values untouched so callers can safely run it
 * over raw database output without branching on the column type themselves.
 */
export function decimalStringToNumberUnsafe(value: unknown): unknown {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return value
    }
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return value
}

/**
 * Coerces bigint-encoded strings into actual `bigint` values while avoiding
 * falsy or empty strings.
 */
export function bigintStringToBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) {
      try {
        return BigInt(trimmed)
      } catch {
        return value
      }
    }
  }
  return value
}

/**
 * Normalizes timestamp values returned by SQL drivers into a valid `Date`.
 *
 * Accepts `Date` instances and parseable timestamp strings.
 * Throws for invalid dates, empty strings, or unsupported value types.
 */
export function timestampFromDriver(value: unknown, fieldName?: string): Date {
  const fieldLabel = fieldName?.trim() ? ` for "${fieldName}"` : ''

  // Preserve valid Date instances while rejecting "Invalid Date".
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid Date value${fieldLabel}.`)
    }
    return value
  }

  // Parse driver-returned timestamp strings after trimming transport whitespace.
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      throw new Error(`Expected a non-empty timestamp string${fieldLabel}.`)
    }

    const timestamp = Date.parse(trimmed)
    if (Number.isNaN(timestamp)) {
      throw new Error(
        `Invalid timestamp string${fieldLabel}: "${value}".`
      )
    }
    return new Date(timestamp)
  }

  const actualType = value === null ? 'null' : typeof value
  throw new Error(
    `Expected Date or timestamp string${fieldLabel}, received ${actualType}.`
  )
}
