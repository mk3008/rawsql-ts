import { describe, expect, it } from 'vitest'
import { z, ZodError } from 'zod'
import { zNumberFromString } from '@rawsql-ts/sql-contract-zod'
import {
  createMapper,
  rowMapping,
  type QueryParams,
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

describe('sql-contract-zod reader', () => {
  const createMapperFromRows = (
    rows: Record<string, unknown>[],
    onQuery?: (params: QueryParams) => void
  ) =>
    createMapper(async (_sql: string, params: QueryParams) => {
      onQuery?.(params)
      return rows
    })

  it('validates mapped rows with list', async () => {
    const mapper = createMapperFromRows([
      { customer_id: 1, customer_name: 'Maple' },
    ])
    const schema = z.object({
      customerId: z.number(),
      customerName: z.string(),
    })

    const reader = mapper.zod(schema, customerMapping)
    await expect(reader.list('select ...')).resolves.toEqual([
      { customerId: 1, customerName: 'Maple' },
    ])
  })

  it('throws ZodError when validation fails', async () => {
    const mapper = createMapperFromRows([
      { customer_id: 'abc', customer_name: 'Maple' },
    ])
    const schema = z.object({
      customerId: z.number(),
      customerName: z.string(),
    })
    const reader = mapper.zod(schema, customerMapping)

    const execution = reader.list('select ...')
    await expect(execution).rejects.toBeInstanceOf(ZodError)
  })

  it('enforces exactly-one contract for one', async () => {
    const schema = z.object({
      customerId: z.number(),
      customerName: z.string(),
    })

    const none = createMapperFromRows([])
    const noneReader = none.zod(schema, customerMapping)
    await expect(noneReader.one('select ...')).rejects.toThrow(
      /expected exactly one row/i
    )

    const many = createMapperFromRows([
      { customer_id: 1, customer_name: 'Maple' },
      { customer_id: 2, customer_name: 'Pine' },
    ])
    const manyReader = many.zod(schema, customerMapping)
    await expect(manyReader.one('select ...')).rejects.toThrow(
      /expected exactly one row/i
    )

    const single = createMapperFromRows([
      { customer_id: 5, customer_name: 'Oak' },
    ])
    const singleReader = single.zod(schema, customerMapping)
    await expect(singleReader.one('select ...')).resolves.toEqual({
      customerId: 5,
      customerName: 'Oak',
    })
  })

  describe('zNumberFromString', () => {
    it('accepts literal numbers, trimmed numeric strings, and decimals', () => {
      expect(zNumberFromString.parse(33)).toBe(33)
      expect(zNumberFromString.parse('33')).toBe(33)
      expect(zNumberFromString.parse(' 33 ')).toBe(33)
      expect(zNumberFromString.parse('33.1')).toBe(33.1)
    })

    it('rejects non-numeric inputs and incompatible types', () => {
      expect(() => zNumberFromString.parse('abc')).toThrow()
      expect(() => zNumberFromString.parse(null)).toThrow()
      expect(() => zNumberFromString.parse(undefined)).toThrow()
      expect(() => zNumberFromString.parse({})).toThrow()
      expect(() => zNumberFromString.parse([])).toThrow()
    })
  })
})
