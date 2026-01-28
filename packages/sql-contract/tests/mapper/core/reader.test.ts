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

const createMapperFromRows = (
  rows: Row[],
  onQuery?: (params: QueryParams) => void
) =>
  createMapper(async (_sql: string, params: QueryParams) => {
    onQuery?.(params)
    return rows
  })

describe('mapper reader', () => {
  it('lists mapped rows and defaults params to []', async () => {
    const rows: Row[] = [
      { customer_id: 1, customer_name: 'Maple' },
    ]
    let lastParams: QueryParams | undefined
    const mapper = createMapperFromRows(rows, (captured) => {
      lastParams = captured
    })

    const reader = mapper.bind(customerMapping)
    const result = await reader.list('select ...')

    expect(lastParams).toEqual([])
    expect(result).toEqual([
      { customerId: 1, customerName: 'Maple' },
    ])
  })

  it('enforces exactly-one contract for one', async () => {
    const none = createMapperFromRows([]).bind(customerMapping)
    await expect(none.one('select ...')).rejects.toThrow(
      /expected exactly one row/i
    )

    const many = createMapperFromRows([
      { customer_id: 1, customer_name: 'Maple' },
      { customer_id: 2, customer_name: 'Pine' },
    ]).bind(customerMapping)
    await expect(many.one('select ...')).rejects.toThrow(
      /expected exactly one row/i
    )

    const single = createMapperFromRows([
      { customer_id: 5, customer_name: 'Oak' },
    ]).bind(customerMapping)
    await expect(single.one('select ...')).resolves.toEqual({
      customerId: 5,
      customerName: 'Oak',
    })
  })
})
