import { describe, expect, it } from 'vitest'
import { zNumberFromString } from '@rawsql-ts/sql-contract-zod'
import {
  createReader,
  type QueryParams,
} from '@rawsql-ts/sql-contract/mapper'

const createReaderFromRows = (
  rows: Record<string, unknown>[],
  onQuery?: (params: QueryParams) => void
) =>
  createReader(async (_sql: string, params: QueryParams) => {
    onQuery?.(params)
    return rows
  })

describe('sql-contract-zod scalar helper', () => {
  it('validates a scalar value with the provided schema', async () => {
    const rows = [{ foo: '7' }]
    const reader = createReaderFromRows(rows)

    await expect(
      reader.scalar(zNumberFromString, 'select count(*) from customers')
    ).resolves.toBe(7)
  })

  it('defaults params to an empty array', async () => {
    const recorded: QueryParams[] = []
    const rows = [{ foo: '7' }]
    const reader = createReaderFromRows(rows, (params) => {
      recorded.push(params)
    })

    await expect(
      reader.scalar(zNumberFromString, 'select count(*) from customers')
    ).resolves.toBe(7)
    expect(recorded).toEqual([[]])
  })

  it('passes provided params to the executor', async () => {
    const recorded: QueryParams[] = []
    const rows = [{ foo: '7' }]
    const reader = createReaderFromRows(rows, (params) => {
      recorded.push(params)
    })

    await expect(
      reader.scalar(
        zNumberFromString,
        'select count(*) from customers where id = $1',
        [123]
      )
    ).resolves.toBe(7)
    expect(recorded).toEqual([[123]])
  })

  it('enforces the single-row and single-column contract', async () => {
    const noneReader = createReaderFromRows([])
    await expect(
      noneReader.scalar(zNumberFromString, 'select count(*) from customers')
    ).rejects.toThrow(/expected exactly one row/i)

    const manyReader = createReaderFromRows([{ count: '1' }, { count: '2' }])
    await expect(
      manyReader.scalar(zNumberFromString, 'select count(*) from customers')
    ).rejects.toThrow(/expected exactly one row/i)

    const wideReader = createReaderFromRows([{ a: 1, b: 2 }])
    await expect(
      wideReader.scalar(zNumberFromString, 'select count(*) from customers')
    ).rejects.toThrow(/scalar query expected exactly one column/i)
  })

  it('throws on validation error', async () => {
    const rows = [{ any: 'not-a-number' }]
    const reader = createReaderFromRows(rows)

    await expect(
      reader.scalar(zNumberFromString, 'select count(*) from customers')
    ).rejects.toThrow(/not a valid number/i)
  })
})
