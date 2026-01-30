import { describe, expect, it } from 'vitest'
import { z, ZodError, type ZodTypeAny } from 'zod'
import { zNumberFromString } from '@rawsql-ts/sql-contract-zod'
import {
  createMapper,
  createReader,
  mapperPresets,
  rowMapping,
  type QueryParams,
} from '@rawsql-ts/sql-contract/mapper'
import { rewriteFixtureQuery } from './support/testkit'

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
const customerSql = 'select customer_id, customer_name, balance from customers'
const customerSqlWithId = `${customerSql} where customer_id = $1`

describe('sql-contract-zod reader', () => {
  const createReaderFromRows = (
    rows: Record<string, unknown>[],
    schema: ZodTypeAny,
    mapping?: ReturnType<typeof rowMapping>,
    onQuery?: (params: QueryParams) => void
  ) => {
    const base = createMapper(async (_sql: string, params: QueryParams) => {
      onQuery?.(params)
      rewriteFixtureQuery(_sql, rows)
      return rows
    })
    return mapping ? base.zod(schema, mapping) : base.zod(schema)
  }

  it('validates mapped rows with list', async () => {
    const schema = z.object({
      customerId: z.number(),
      customerName: z.string(),
    })

    const reader = createReaderFromRows(
      [{ customer_id: 1, customer_name: 'Maple' }],
      schema,
      customerMapping
    )
    await expect(reader.list(customerSql)).resolves.toEqual([
      { customerId: 1, customerName: 'Maple' },
    ])
  })

  it('createReader binds executor with preset conventions', async () => {
    const recorded: QueryParams[] = []
    const rows = [{ customer_id: 1, customer_name: 'Maple' }]
    const schema = z.object({
      customerId: z.number(),
      customerName: z.string(),
    })

    const reader = createReader(
      async (_sql, params) => {
        recorded.push(params)
        rewriteFixtureQuery(_sql, rows)
        return rows
      },
      mapperPresets.appLike(),
    ).zod(schema)

    await expect(reader.one(customerSql)).resolves.toEqual({
      customerId: 1,
      customerName: 'Maple',
    })
    expect(recorded).toEqual([[]])
  })

  it('defaults to appLike mapping when no options are supplied', async () => {
    const rows = [{ customer_id: 3, customer_name: 'Oak' }]
    const reader = createReader(async (_sql) => {
      rewriteFixtureQuery(_sql, rows)
      return rows
    }).zod(
      z.object({
        customerId: z.number(),
        customerName: z.string(),
      }),
    )

    await expect(reader.one(customerSqlWithId, [42])).resolves.toEqual({
      customerId: 3,
      customerName: 'Oak',
    })
  })

  it('throws ZodError when validation fails', async () => {
    const schema = z.object({
      customerId: z.number(),
      customerName: z.string(),
    })
    const reader = createReaderFromRows(
      [{ customer_id: 'abc', customer_name: 'Maple' }],
      schema,
      customerMapping
    )

    const execution = reader.list(customerSql)
    await expect(execution).rejects.toBeInstanceOf(ZodError)
  })

  it('applies preset-based conventions when schema-only reader is used', async () => {
    const recorded: QueryParams[] = []
    const rows = [{ customer_id: 1, customer_name: 'Maple' }]
    const schema = z.object({
      customerId: z.string(),
      customerName: z.string(),
    })

    const reader = createReaderFromRows(rows, schema, undefined, (params) => {
      recorded.push(params)
    })
    await expect(reader.list(customerSql)).resolves.toEqual([
      { customerId: '1', customerName: 'Maple' },
    ])
    await expect(reader.one(customerSql)).resolves.toEqual({
      customerId: '1',
      customerName: 'Maple',
    })
    expect(recorded).toEqual([[], []])
  })

  it('enforces exactly-one contract for one', async () => {
    const schema = z.object({
      customerId: z.number(),
      customerName: z.string(),
    })

    const noneReader = createReaderFromRows([], schema, customerMapping)
    await expect(noneReader.one(customerSql)).rejects.toThrow(
      /expected exactly one row/i
    )

    const manyReader = createReaderFromRows(
      [
        { customer_id: 1, customer_name: 'Maple' },
        { customer_id: 2, customer_name: 'Pine' },
      ],
      schema,
      customerMapping
    )
    await expect(manyReader.one(customerSql)).rejects.toThrow(
      /expected exactly one row/i
    )

    const singleReader = createReaderFromRows(
      [{ customer_id: 5, customer_name: 'Oak' }],
      schema,
      customerMapping
    )
    await expect(singleReader.one(customerSql)).resolves.toEqual({
      customerId: 5,
      customerName: 'Oak',
    })
  })

  it('enforces exactly-one contract for schema-only reader', async () => {
    const schema = z.object({
      customerId: z.string(),
      customerName: z.string(),
    })

    const noneReader = createReaderFromRows([], schema)
    await expect(noneReader.one(customerSql)).rejects.toThrow(
      /expected exactly one row/i
    )

    const manyReader = createReaderFromRows(
      [
        { customer_id: 1, customer_name: 'Maple' },
        { customer_id: 2, customer_name: 'Pine' },
      ],
      schema
    )
    await expect(manyReader.one(customerSql)).rejects.toThrow(
      /expected exactly one row/i
    )

    const singleReader = createReaderFromRows(
      [{ customer_id: 5, customer_name: 'Oak' }],
      schema
    )
    await expect(singleReader.one(customerSql)).resolves.toEqual({
      customerId: '5',
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

