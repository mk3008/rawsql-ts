// Zod validation snippet that shows a successful schema parse plus a failing row.
// The success case proves `zNumberFromString` converting a numeric string, while the failure shows the thrown ZodError path.
import { expect, it } from 'vitest'
import { z, ZodError } from 'zod'
import { rowMapping } from '@rawsql-ts/sql-contract/mapper'
import { decimalStringToNumberUnsafe } from '@rawsql-ts/sql-contract'
import { driverDescribe } from '../mapper/driver/driver-describe'
import { getReadmePgContext } from './support/postgres-demo'

driverDescribe('README DTO validation with Zod', () => {
  const schema = z.object({
    id: z.number(),
    label: z.string(),
    price: z.preprocess(decimalStringToNumberUnsafe, z.number()),
  })

  const mapping = rowMapping<{
    id: number
    label: string
    price: string
  }>({
    name: 'ValidationItem',
    key: 'id',
    columnMap: {
      id: 'id',
      label: 'label',
      price: 'price',
    },
  })

  it('accepts rows that match the schema', async () => {
    const ctx = await getReadmePgContext()
    const reader = ctx.mapper.bind(mapping).validator(schema)
    const sql = `
      SELECT id, label, price
      FROM ${ctx.schemaName}.${ctx.tables.validationItems}
      WHERE label = 'valid'
    `
    const result = await reader.list(sql)
    expect(result).toEqual([
      { id: 31, label: 'valid', price: 19.99 },
    ])
  })

  it('rejects invalid rows and surfaces the ZodError path', async () => {
    const ctx = await getReadmePgContext()
    const reader = ctx.mapper.bind(mapping).validator(schema)
    const sql = `
      SELECT id, label, price
      FROM ${ctx.schemaName}.${ctx.tables.validationItems}
      WHERE label = 'invalid'
    `
    const error = await reader.list(sql).catch((err) => err)
    expect(error).toBeInstanceOf(ZodError)
    const issues = (error as ZodError).issues
    expect(issues[0].path).toEqual(['price'])
  })
})
