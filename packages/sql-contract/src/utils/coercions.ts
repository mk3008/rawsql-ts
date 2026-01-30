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
