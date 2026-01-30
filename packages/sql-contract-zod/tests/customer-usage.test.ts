import { describe, expect, it } from 'vitest'
import { z, ZodError, type ZodTypeAny } from 'zod'
import { zNumberFromString } from '@rawsql-ts/sql-contract-zod'
import {
  createMapper,
  rowMapping,
  type QueryParams,
  type Row,
} from '@rawsql-ts/sql-contract/mapper'
import { rewriteFixtureQuery } from './support/testkit'

const CustomerSchema = z.object({
  customerId: z.number(),
  customerName: z.string(),
  balance: zNumberFromString,
})

type Customer = z.infer<typeof CustomerSchema>

const customerMapping = rowMapping<Customer>({
  name: 'Customer',
  key: 'customerId',
  columnMap: {
    customerId: 'customer_id',
    customerName: 'customer_name',
    balance: 'balance',
  },
})

const customerSql =
  'select customer_id, customer_name, balance from customers where active = true'

const createReaderFromRows = (
  rows: Row[],
  schema: ZodTypeAny,
  mapping: ReturnType<typeof rowMapping>,
  onQuery?: (params: QueryParams) => void
) => {
  const base = createMapper(async (_sql: string, params: QueryParams) => {
    onQuery?.(params)
    rewriteFixtureQuery(_sql, rows)
    return rows
  })
  return base.zod(schema, mapping)
}

describe('customer usage styles', () => {
  it('reader.list validates and returns Customer[] (mapped + transformed)', async () => {
    const rows: Row[] = [
      { customer_id: 42, customer_name: 'Maple', balance: '33' },
    ]

    let lastParams: QueryParams | undefined
    const reader = createReaderFromRows(
      rows,
      CustomerSchema,
      customerMapping,
      (captured) => {
        lastParams = captured
      }
    )
    const customers: Customer[] = await reader.list(customerSql)

    expect(lastParams).toEqual([])
    expect(customers).toEqual([
      {
        customerId: 42,
        customerName: 'Maple',
        balance: 33,
      },
    ])
  })

  it('reader.list fails when mapped identifiers violate the schema', async () => {
    const rows: Row[] = [
      { customer_id: 'abc', customer_name: 'Maple', balance: '33' },
    ]
    const reader = createReaderFromRows(rows, CustomerSchema, customerMapping)
    const resultOrError = await reader.list(customerSql).catch((error) => error)

    expect(resultOrError).toBeInstanceOf(ZodError)
    const error = resultOrError as ZodError
    const issue = error.issues.find(
      (issue) => issue.path.join('.') === '0.customerId'
    )

    expect(issue).toBeDefined()
    expect(issue?.message).toBeTruthy()
  })

  it('passes through provided params when supplied', async () => {
    const rows: Row[] = [
      { customer_id: 900, customer_name: 'Maple', balance: 77 },
    ]
    const params: QueryParams = [{ turn: 'left' }]
    let lastParams: QueryParams | undefined
    const reader = createReaderFromRows(
      rows,
      CustomerSchema,
      customerMapping,
      (captured) => {
        lastParams = captured
      }
    )
    const customers: Customer[] = await reader.list(customerSql, params)

    expect(customers).toEqual([
      {
        customerId: 900,
        customerName: 'Maple',
        balance: 77,
      },
    ])
    expect(lastParams).toBe(params)
  })

  it('supports joined row mapping with belongsTo', async () => {
    const OrderCustomerSchema = z.object({
      customerId: z.number(),
      customerName: z.string(),
    })

    type OrderCustomer = z.infer<typeof OrderCustomerSchema>

    const orderCustomerMapping = rowMapping<OrderCustomer>({
      name: 'OrderCustomer',
      key: 'customerId',
      columnMap: {
        customerId: 'customer_id',
        customerName: 'customer_name',
      },
    })

    const OrderWithCustomerSchema = z.object({
      orderId: z.number(),
      orderTotal: z.number(),
      customerId: z.number(),
      customer: OrderCustomerSchema,
    })

    type OrderWithCustomer = z.infer<typeof OrderWithCustomerSchema>

    const orderWithCustomerMapping = rowMapping<OrderWithCustomer>({
      name: 'Order',
      key: 'orderId',
      columnMap: {
        orderId: 'order_id',
        orderTotal: 'order_total',
        customerId: 'customer_id',
      },
    }).belongsTo('customer', orderCustomerMapping, 'customerId')

    const rows: Row[] = [
      {
        order_id: 123,
        order_total: 88,
        customer_id: 9,
        customer_name: 'Maple',
      },
    ]

    const reader = createReaderFromRows(
      rows,
      OrderWithCustomerSchema,
      orderWithCustomerMapping
    )

    const [result] = await reader.list(customerSql)

    expect(result).toEqual({
      orderId: 123,
      orderTotal: 88,
      customerId: 9,
      customer: {
        customerId: 9,
        customerName: 'Maple',
      },
    })
  })
})

