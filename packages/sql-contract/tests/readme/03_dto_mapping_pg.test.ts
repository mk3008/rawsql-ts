// DTO mapping snippet that highlights how to connect a RowMapping to Postgres columns.
// It shows a clean SQL statement plus the matching `rowMapping` definition for camelCase DTOs.
import { expect, it } from 'vitest'
import { rowMapping } from '@rawsql-ts/sql-contract/mapper'
import { driverDescribe } from '../mapper/driver/driver-describe'
import { getReadmePgContext } from './support/postgres-demo'

driverDescribe('README DTO mapping demo', () => {
  it('binds a RowMapping and returns DTOs from a SELECT query', async () => {
    const ctx = await getReadmePgContext()
    const mapping = rowMapping<{
      itemId: number
      label: string
      value: number
    }>({
      name: 'DtoItem',
      key: 'itemId',
      columnMap: {
        itemId: 'dto_id',
        label: 'dto_label',
        value: 'dto_value',
      },
    })

    const reader = ctx.mapper.bind(mapping)

    const listSql = `
      SELECT dto_id, dto_label, dto_value
      FROM ${ctx.schemaName}.${ctx.tables.dtoItems}
      ORDER BY dto_id
    `
    const list = await reader.list(listSql)
    expect(list).toEqual([
      { itemId: 21, label: 'primary', value: 5.5 },
      { itemId: 22, label: 'secondary', value: 9.75 },
    ])

    const oneSql = `
      SELECT dto_id, dto_label, dto_value
      FROM ${ctx.schemaName}.${ctx.tables.dtoItems}
      WHERE dto_id = 22
    `
    const single = await reader.one(oneSql)
    expect(single.value).toBeCloseTo(9.75)
  })
})
