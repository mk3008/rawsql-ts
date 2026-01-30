import { describe, expect, it } from 'vitest'
import {
  decimalStringToNumberUnsafe,
  bigintStringToBigInt,
} from '@rawsql-ts/sql-contract'
import {
  zNumberFromString,
  zBigIntFromString,
} from '@rawsql-ts/sql-contract-zod'

describe('coercion helper parity', () => {
  it('shares the same decimal conversion behavior as the Zod helper', () => {
    const valid = '  33.5  '
    const coerced = decimalStringToNumberUnsafe(valid)
    expect(coerced).toBeCloseTo(33.5)
    expect(zNumberFromString.parse(valid)).toBeCloseTo(33.5)

    const invalidCases = ['', 'foo', 'Infinity']
    for (const candidate of invalidCases) {
      expect(decimalStringToNumberUnsafe(candidate)).toBe(candidate)
      expect(() => zNumberFromString.parse(candidate)).toThrow(
        `'${candidate}' is not a valid number.`
      )
    }
  })

  it('keeps bigint conversion aligned between the helper and Zod', () => {
    const valid = '  123456789012345678901234567890  '
    const coerced = bigintStringToBigInt(valid)
    expect(coerced).toBe(123456789012345678901234567890n)
    expect(zBigIntFromString.parse(valid)).toBe(
      123456789012345678901234567890n
    )

    const invalidCases = ['', 'not-a-bigint']
    for (const candidate of invalidCases) {
      expect(bigintStringToBigInt(candidate)).toBe(candidate)
      expect(() => zBigIntFromString.parse(candidate)).toThrow(
        `'${candidate}' is not a valid bigint.`
      )
    }
  })
})
