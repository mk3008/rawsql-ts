import { describe, expect, it } from 'vitest'
import { timestampFromDriver } from '@rawsql-ts/sql-contract'

describe('timestampFromDriver', () => {
  it('returns valid Date instances as-is', () => {
    const input = new Date('2025-01-15T09:00:00.000Z')

    const result = timestampFromDriver(input)

    expect(result).toBe(input)
    expect(result.toISOString()).toBe('2025-01-15T09:00:00.000Z')
  })

  it('throws for invalid Date instances', () => {
    expect(() => timestampFromDriver(new Date('invalid'))).toThrow(
      'Invalid Date value'
    )
  })

  it('parses valid ISO timestamp strings into Date', () => {
    const result = timestampFromDriver(' 2025-01-15T09:00:00+00:00 ')

    expect(result).toBeInstanceOf(Date)
    expect(result.toISOString()).toBe('2025-01-15T09:00:00.000Z')
  })

  it('throws for invalid timestamp strings', () => {
    expect(() =>
      timestampFromDriver('not-a-timestamp', 'issuedAt')
    ).toThrow('Invalid timestamp string for "issuedAt"')
  })

  it('throws for non-string/non-Date values', () => {
    expect(() => timestampFromDriver(123, 'issuedAt')).toThrow(
      'Expected Date or timestamp string for "issuedAt", received number.'
    )
  })
})
