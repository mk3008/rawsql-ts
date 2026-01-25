import { describe, expect, it } from 'vitest'
import { z, ZodError } from 'zod'
import {
  MapperLike,
  queryZod,
  zNumberFromString,
} from '@rawsql-ts/sql-contract-zod'
import {
  mapRows,
  rowMapping,
  Row,
  RowMapping,
  type QueryParams,
} from '@rawsql-ts/sql-contract-core/mapper'

const CustomerSchema = z.object({
  customerId: z.number(),
  customerName: z.string(),
  balance: zNumberFromString,
})

type Customer = z.infer<typeof CustomerSchema>

// core mapping: snake_case -> camelCase
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

const createMapper = (
  rows: Row[],
  onQuery?: (params?: QueryParams) => void
): MapperLike => {
  const applyMapping = async <T>(mapping?: RowMapping<T>): Promise<T[]> => {
    if (mapping) {
      return mapRows(rows, mapping)
    }
    return rows as unknown as T[]
  }

  return {
    query: async <T>(
      _sql: string,
      _params?: QueryParams,
      mapping?: RowMapping<T>
    ) => {
      onQuery?.(_params)
      return applyMapping<T>(mapping)
    },
    // Not used in this file, but required by MapperLike.
    queryOne: async <T>(
      _sql: string,
      _params?: QueryParams,
      mapping?: RowMapping<T>
    ) => {
      onQuery?.(_params)
      const [row] = await applyMapping<T>(mapping)
      return row
    },
  }
}

// zod boundary: validate + explicit transforms
describe('customer usage styles', () => {
  it('queryZod validates and returns Customer[] (mapped + transformed)', async () => {
    const rows: Row[] = [
      { customer_id: 42, customer_name: 'Maple', balance: '33' },
    ]

    let lastParams: QueryParams | undefined
    const mapper = createMapper(rows, (captured) => {
      lastParams = captured
    })

    const customers: Customer[] = await queryZod(
      mapper,
      CustomerSchema,
      customerSql,
      customerMapping
    )

    expect(lastParams).toBeUndefined()
    expect(customers).toEqual([
      {
        customerId: 42,
        customerName: 'Maple',
        balance: 33,
      },
    ])
  })

  it('queryZod fails when mapped identifiers violate the schema', async () => {
    const rows: Row[] = [
      { customer_id: 'abc', customer_name: 'Maple', balance: '33' },
    ]
    const mapper = createMapper(rows)

    const resultOrError = await queryZod(
      mapper,
      CustomerSchema,
      customerSql,
      customerMapping
    ).catch((error) => error)

    expect(resultOrError).toBeInstanceOf(ZodError)
    const error = resultOrError as ZodError
    const issue = error.issues.find(
      (issue) => issue.path.join('.') === '0.customerId'
    )

    expect(issue).toBeDefined()
    // Avoid overfitting to `issue.code` (may change across Zod versions).
    expect(issue?.message).toBeTruthy()
  })

  it('queryZod overload: 4th arg is params when mapping is omitted', async () => {
    const rows: Row[] = [
      { customerId: 900, customerName: 'Maple', balance: 77 },
    ]
    const params: QueryParams = [{ turn: 'left' }]
    let lastParams: QueryParams | undefined
    const mapper = createMapper(rows, (captured) => {
      lastParams = captured
    })

    const customers: Customer[] = await queryZod(
      mapper,
      CustomerSchema,
      customerSql,
      params
    )

    expect(customers).toEqual([
      {
        customerId: 900,
        customerName: 'Maple',
        balance: 77,
      },
    ])
    expect(lastParams).toBe(params)
  })

  it('queryZod overload: accepts params and mapping simultaneously', async () => {
    const rows: Row[] = [
      { customer_id: 101, customer_name: 'Maple', balance: '33' },
    ]
    const params: QueryParams = [{ turn: 'right' }]
    let lastParams: QueryParams | undefined
    const mapper = createMapper(rows, (captured) => {
      lastParams = captured
    })

    const customers: Customer[] = await queryZod(
      mapper,
      CustomerSchema,
      customerSql,
      params,
      customerMapping
    )

    expect(lastParams).toBe(params)
    expect(customers).toEqual([
      {
        customerId: 101,
        customerName: 'Maple',
        balance: 33,
      },
    ])
  })
})
