import { describe, expect, it } from 'vitest'
import {
  createMapper,
  rowMapping,
  type QueryParams,
  type Row,
} from '@rawsql-ts/sql-contract/mapper'

type Customer = {
  customerId: number
  customerName: string
}

const customerMapping = rowMapping<Customer>({
  name: 'Customer',
  key: 'customerId',
  columnMap: {
    customerId: 'customer_id',
    customerName: 'customer_name',
  },
})

const createReaderFromRows = (
  rows: Row[],
  onQuery?: (params: QueryParams) => void
) => {
  const base = createMapper(async (_sql: string, params: QueryParams) => {
    onQuery?.(params)
    return rows
  })
  return base.bind(customerMapping)
}

describe('reader validator and scalar', () => {
  it('applies post-mapping validator hook to mapped DTOs', async () => {
    const reader = createReaderFromRows([
      { customer_id: 7, customer_name: 'Maple' },
    ])
    let called = 0

    const readerWithValidator = reader.validator((customer) => {
      called += 1
      if (!('customerName' in customer)) {
        throw new Error('missing mapped key')
      }
      if ('customer_name' in (customer as Record<string, unknown>)) {
        throw new Error('raw key leaked')
      }
      return {
        ...customer,
        customerName: customer.customerName.toUpperCase(),
      }
    })

    await expect(readerWithValidator.list('select ...')).resolves.toEqual([
      { customerId: 7, customerName: 'MAPLE' },
    ])
    expect(called).toBe(1)
  })

  it('returns a scalar value (ignores row mapping)', async () => {
    const reader = createReaderFromRows([
      { total_count: '2' },
    ])

    await expect(reader.scalar('select count(*)')).resolves.toBe('2')
  })

  it('applies validator to scalar values and allows transform', async () => {
    const readerBase = createReaderFromRows([
      { total_count: '5' },
    ])
    let called = 0

    const reader = readerBase.validator((value) => {
      called += 1
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        throw new Error('invalid number')
      }
      return parsed
    })

    await expect(reader.scalar('select count(*)')).resolves.toBe(5)
    expect(called).toBe(1)
  })

  it('rejects scalar values when validator throws', async () => {
    const readerBase = createReaderFromRows([
      { total_count: 'abc' },
    ])

    const reader = readerBase.validator((value) => {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        throw new Error('invalid number')
      }
      return parsed
    })

    await expect(reader.scalar('select count(*)')).rejects.toThrow(
      /invalid number/i
    )
  })

  it('throws when scalar results contain zero rows, multiple rows, or multiple columns', async () => {
    const none = createReaderFromRows([])
    await expect(none.scalar('select ...')).rejects.toThrow(
      /expected exactly one row/i
    )

    const many = createReaderFromRows([
      { total_count: 1 },
      { total_count: 2 },
    ])
    await expect(many.scalar('select ...')).rejects.toThrow(
      /expected exactly one row/i
    )

    const multipleColumns = createReaderFromRows([
      { total_count: 1, other: 2 },
    ])
    await expect(multipleColumns.scalar('select ...')).rejects.toThrow(
      /expected exactly one column/i
    )
  })
})
