// Core API snippet showing how to bind a RowMapping and walk through list, one, and scalar calls.
// The SQL strings are literal Postgres statements that readers can copy into their console.
// This keeps the focus on the mapper wiring rather than helper abstractions.
import { expect, it } from 'vitest'
import { rowMapping } from '@rawsql-ts/sql-contract/mapper'
import { driverDescribe } from '../mapper/driver/driver-describe'
import { getReadmePgContext } from './support/postgres-demo'

driverDescribe('README core API demo', () => {
  it('binds a mapping and works through list, one, and scalar', async () => {
    const ctx = await getReadmePgContext()
    const mapping = rowMapping<{
      id: number
      label: string
      summary: string
    }>({
      name: 'CoreItem',
      key: 'id',
      columnMap: {
        id: 'id',
        label: 'label',
        summary: 'summary',
      },
    })

    const reader = ctx.mapper.bind(mapping)

    const listSql = `
      SELECT id, label, summary
      FROM ${ctx.schemaName}.${ctx.tables.coreItems}
      ORDER BY id
    `
    const list = await reader.list(listSql)
    expect(list).toEqual([
      { id: 1, label: 'alpha', summary: 'first entry' },
      { id: 2, label: 'beta', summary: 'second entry' },
    ])

    const oneSql = `
      SELECT id, label, summary
      FROM ${ctx.schemaName}.${ctx.tables.coreItems}
      WHERE id = 2
    `
    const single = await reader.one(oneSql)
    expect(single.label).toBe('beta')

    const countSql = `
      SELECT COUNT(*) AS total
      FROM ${ctx.schemaName}.${ctx.tables.coreItems}
    `
    const count = await reader.scalar(countSql)
    expect(Number(count)).toBe(2)
  })
})
