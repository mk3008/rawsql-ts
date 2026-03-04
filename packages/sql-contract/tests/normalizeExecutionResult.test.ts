import { describe, expect, it } from 'vitest'
import { normalizeExecutionResult } from '../src/normalizeExecutionResult'

describe('normalizeExecutionResult', () => {
  it('returns rows for array-shaped results', () => {
    const normalized = normalizeExecutionResult([{ id: 1 }])
    expect(normalized).toEqual({ rows: [{ id: 1 }] })
  })

  it('returns rows and rowCount for object-shaped results', () => {
    const normalized = normalizeExecutionResult({
      rows: [{ id: 1 }],
      rowCount: 1,
    })
    expect(normalized).toEqual({ rows: [{ id: 1 }], rowCount: 1 })
  })

  it('throws when rows is missing', () => {
    expect(() => normalizeExecutionResult({ rowCount: 1 } as unknown)).toThrow(
      /normalizeExecutionResult expected an array or \{ rows, rowCount\? \} object/i
    )
  })

  it('throws when rows is not an array', () => {
    expect(() =>
      normalizeExecutionResult({ rows: 'invalid' } as unknown)
    ).toThrow(/expected "rows" to be an array/i)
  })
  it('throws when rowCount is not a number', () => {
    expect(() =>
      normalizeExecutionResult({ rows: [{ id: 1 }], rowCount: '1' } as unknown)
    ).toThrow(/expected "rowCount" to be a number/i)
  })
})

