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

describe('mapper reader schema-like validators', () => {
  it('applies schema.parse implementations to mapped rows', async () => {
    const reader = createReaderFromRows([
      { customer_id: 4, customer_name: 'Maple' },
    ])
    let parseCalls = 0

    const schemaLike = {
      parse(value: Customer) {
        parseCalls += 1
        return {
          ...value,
          customerName: value.customerName.toUpperCase(),
        }
      },
    }

    const validated = reader.validator(schemaLike)

    await expect(validated.list('select ...')).resolves.toEqual([
      { customerId: 4, customerName: 'MAPLE' },
    ])
    expect(parseCalls).toBe(1)
  })

  it('applies schema.assert validations and returns the original row', async () => {
    const reader = createReaderFromRows([
      { customer_id: 9, customer_name: 'Oak' },
    ])
    let assertCalls = 0

    const schemaLike = {
      assert(value: Customer): asserts value is Customer {
        assertCalls += 1
        if (typeof value.customerId !== 'number') {
          throw new Error('invalid customerId')
        }
      },
    }

    const validated = reader.validator(schemaLike)

    await expect(validated.one('select ...')).resolves.toEqual({
      customerId: 9,
      customerName: 'Oak',
    })
    expect(assertCalls).toBe(1)
  })

  it('rejects schema-like objects that lack parse/assert', () => {
    const reader = createReaderFromRows([
      { customer_id: 3, customer_name: 'Willow' },
    ])

    expect(() => reader.validator({} as any)).toThrow(
      /reader\.validator expects a function or an object with parse\/assert methods\./
    )
  })
})
