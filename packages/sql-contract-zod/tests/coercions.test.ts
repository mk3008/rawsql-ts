import { describe, expect, it } from 'vitest'
import {
  decimalStringToNumberUnsafe,
  bigintStringToBigInt,
} from '@rawsql-ts/sql-contract'
import {
  zNumberFromString,
  zBigIntFromString,
} from '@rawsql-ts/sql-contract-zod'
import {
  bigintTrimmedScenario,
  decimalTrimmedScenario,
} from './_fixtures/coercionScenario'

describe('coercion helper parity', () => {
  it('shares the same decimal conversion behavior as the Zod helper', () => {
    const coerced = decimalStringToNumberUnsafe(decimalTrimmedScenario.input)
    expect(coerced).toBeCloseTo(decimalTrimmedScenario.expectedOutput)
    expect(zNumberFromString.parse(decimalTrimmedScenario.input)).toBeCloseTo(
      decimalTrimmedScenario.expectedOutput
    )

    const invalidCases = ['', 'foo', 'Infinity']
    for (const candidate of invalidCases) {
      expect(decimalStringToNumberUnsafe(candidate)).toBe(candidate)
      expect(() => zNumberFromString.parse(candidate)).toThrow(
        `'${candidate}' is not a valid number.`
      )
    }
  })

  it('keeps bigint conversion aligned between the helper and Zod', () => {
    const coerced = bigintStringToBigInt(bigintTrimmedScenario.input)
    expect(coerced).toBe(bigintTrimmedScenario.expectedOutput)
    expect(zBigIntFromString.parse(bigintTrimmedScenario.input)).toBe(
      bigintTrimmedScenario.expectedOutput
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
