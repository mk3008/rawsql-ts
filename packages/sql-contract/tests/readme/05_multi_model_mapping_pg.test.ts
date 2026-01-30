// Multi-model mapping snippet that pairs `rowMapping` with `belongsTo` so a join becomes a nested DTO.
// The SQL uses clear aliases so every column name matches the mapping's `columnMap`.
import { expect, it } from 'vitest'
import { rowMapping } from '@rawsql-ts/sql-contract/mapper'
import { driverDescribe } from '../mapper/driver/driver-describe'
import { getReadmePgContext } from './support/postgres-demo'

driverDescribe('README multi-model mapping demo', () => {
  it('hydrates nested customer information from a join', async () => {
    const ctx = await getReadmePgContext()
    const customerMapping = rowMapping<{ customerId: number; customerName: string }>({
      name: 'Customer',
      key: 'customerId',
      columnMap: {
        customerId: 'customer_customer_id',
        customerName: 'customer_customer_name',
      },
    })

    const orderMapping = rowMapping<{
      orderId: number
      orderTotal: number
      customerId: number
      customer: { customerId: number; customerName: string }
    }>({
      name: 'Order',
      key: 'orderId',
      columnMap: {
        orderId: 'order_order_id',
        orderTotal: 'order_total',
        customerId: 'order_customer_id',
      },
    }).belongsTo('customer', customerMapping, 'customerId')

    const reader = ctx.mapper.bind(orderMapping)
    const sql = `
      SELECT
        o.id AS order_order_id,
        o.total AS order_total,
        o.customer_id AS order_customer_id,
        c.id AS customer_customer_id,
        c.name AS customer_customer_name
      FROM ${ctx.schemaName}.${ctx.tables.orders} o
      JOIN ${ctx.schemaName}.${ctx.tables.customers} c ON c.id = o.customer_id
      ORDER BY o.id
    `

    const orders = await reader.list(sql)
    expect(orders[0]).toEqual({
      orderId: 201,
      orderTotal: 59.95,
      customerId: 101,
      customer: {
        customerId: 101,
        customerName: 'Maple',
      },
    })
  })
})
