import pgPromise from 'pg-promise'
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import {
  afterAll,
  beforeAll,
  expect,
  it,
} from 'vitest'
import {
  createMapperFromExecutor,
  mapperPresets,
  type QueryParams,
} from '@rawsql-ts/sql-contract/mapper'
import { driverDescribe } from './driver-describe'

type Customer = {
  customerId: number
  customerName: string
  customerStatus: string
}

const pgp = pgPromise()

let container: StartedPostgreSqlContainer | undefined
let db: pgPromise.IDatabase<unknown> | undefined

const ensureDb = (): pgPromise.IDatabase<unknown> => {
  if (!db) {
    throw new Error('pg-promise database is not initialized')
  }
  return db
}

driverDescribe('mapper driver named-parameter integration (pg-promise)', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start()
    db = pgp({
      connectionString: container.getConnectionUri(),
    })
    await ensureDb().none(`
      CREATE TABLE customers_named_params (
        customer_id integer PRIMARY KEY,
        customer_name text NOT NULL,
        customer_status text NOT NULL
      )
    `)
    await ensureDb().none(`
      INSERT INTO customers_named_params (customer_id, customer_name, customer_status)
      VALUES
        (42, 'alice', 'active'),
        (99, 'bob', 'pending')
    `)
  }, 120000)

  afterAll(async () => {
    await db?.$pool.end()
    await container?.stop()
  })

  it('passes named SQL and object params untouched to the executor', async () => {
    let seenSql: string | undefined
    let seenParams: QueryParams | undefined

    const mapper = createMapperFromExecutor(
      async (sql, params) => {
        seenSql = sql
        seenParams = params
        if (!params || Array.isArray(params)) {
          throw new Error('Expected named params object')
        }

        const rows = await ensureDb().any(sql, params)
        return rows
      },
      mapperPresets.safe()
    )
    
    const namedSql = `
      select
        customer_id,
        customer_name,
        customer_status
      from customers_named_params
      where customer_id = $/customerId/
    `
    const namedParams = { customerId: 42 }

    const rows = await mapper.query(namedSql, namedParams)

    expect(rows.length).toBeGreaterThan(0)
    const row = rows[0]
    expect(row).toHaveProperty('customer_id')
    expect(row).toHaveProperty('customer_name')
    expect(row).toHaveProperty('customer_status')
    expect(seenSql).toBe(namedSql)
    expect(seenParams).toEqual(namedParams)
  })
})
