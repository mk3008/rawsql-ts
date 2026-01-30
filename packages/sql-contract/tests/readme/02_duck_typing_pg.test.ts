// Duck-typing demo that uses `Mapper.query` with type hints instead of a full RowMapping.
// The SQL remains explicit, and the snippet shows how to treat snake_case columns as camelCase DTO fields.
import { expect, it } from 'vitest'
import { driverDescribe } from '../mapper/driver/driver-describe'
import { getReadmePgContext } from './support/postgres-demo'

driverDescribe('README duck typing demo', () => {
  it('maps raw rows to a DTO via mapper options and type hints', async () => {
    const ctx = await getReadmePgContext()
    const sql = `
      SELECT item_id, item_name, created_at
      FROM ${ctx.schemaName}.${ctx.tables.duckItems}
      ORDER BY item_id
    `

    const rows = await ctx.mapper.query<{
      itemId: number
      itemName: string
      createdAt: Date
    }>(sql, [], {
      typeHints: {
        itemId: 'number',
        createdAt: 'date',
      },
    })

    expect(rows[0].itemId).toBe(10)
    expect(rows[0].itemName).toBe('notebook')
    expect(rows[0].createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })
})
