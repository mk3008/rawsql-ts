import { Client } from 'pg'
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
  SimpleMapOptions,
  toRowsExecutor,
} from '@rawsql-ts/sql-contract/mapper'
import { driverDescribe } from './driver-describe'

let container: StartedPostgreSqlContainer | undefined
let client: Client | undefined

const ensureClient = (): Client => {
  if (!client) {
    throw new Error('Postgres client is not ready')
  }
  return client
}

const createTestMapper = (options?: SimpleMapOptions) => {
  const executor = toRowsExecutor((sql, params) =>
    ensureClient().query(sql, params)
  )
  return createMapperFromExecutor(executor, options)
}

const decimalCoerce: SimpleMapOptions['coerceFn'] = ({ value }) => {
  if (typeof value !== 'string') {
    return value
  }
  if (!value.includes('.') || Number.isNaN(Number(value))) {
    return value
  }
  return Number(value)
}

driverDescribe('mapper driver integration (pg)', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start()
    client = new Client({
      connectionString: container.getConnectionUri(),
    })
    await client.connect()
  }, 120000)

  afterAll(async () => {
    await client?.end()
    await container?.stop()
  })

  it('coerceDates transforms text/timestamp/timestamptz columns into Date', async () => {
    const mapper = createTestMapper({ coerceDates: true })

    const [record] = await mapper.query<{
      issuedAtText: Date
      issuedAtTimestamp: Date
      issuedAtTimestamptz: Date
    }>(
      `
        SELECT
          '2025-01-15T09:00:00+00:00'::text AS issued_at_text,
          '2025-01-15T09:00:00+00:00'::timestamp AS issued_at_timestamp,
          '2025-01-15T09:00:00+00:00'::timestamptz AS issued_at_timestamptz
      `,
      []
    )

    expect(record.issuedAtText).toBeInstanceOf(Date)
    expect(record.issuedAtText.toISOString()).toBe(
      '2025-01-15T09:00:00.000Z'
    )
    expect(record.issuedAtTimestamp).toBeInstanceOf(Date)
    // Timestamp columns are interpreted without timezone info. Assert via UTC fields so the test
    // remains deterministic regardless of the container clock zone.
    expect(record.issuedAtTimestamp.getUTCFullYear()).toBe(2025)
    expect(record.issuedAtTimestamp.getUTCMonth()).toBe(0)
    expect(record.issuedAtTimestamp.getUTCDate()).toBe(15)
    expect(record.issuedAtTimestamp.getUTCHours()).toBe(0)
    expect(record.issuedAtTimestamp.getUTCMinutes()).toBe(0)
    expect(record.issuedAtTimestamp.getUTCSeconds()).toBe(0)
    expect(record.issuedAtTimestamptz).toBeInstanceOf(Date)
    expect(record.issuedAtTimestamptz.toISOString()).toBe(
      '2025-01-15T09:00:00.000Z'
    )
  })

  it('retains strings when coerceDates is disabled', async () => {
    const mapper = createTestMapper()

    const [record] = await mapper.query<{ issuedAtText: string }>(
      `
        SELECT
          '2025-01-15T09:00:00+00:00'::text AS issued_at_text
      `,
      []
    )

    expect(record.issuedAtText).toBe('2025-01-15T09:00:00+00:00')
    expect(typeof record.issuedAtText).toBe('string')
  })

  it('leaves numeric strings untouched unless a custom coerceFn runs', async () => {
    const mapper = createTestMapper()

    const [plain] = await mapper.query<{ amount: string }>(
      `
        SELECT
          '123.45'::numeric::text AS amount
      `,
      []
    )

    expect(plain.amount).toBe('123.45')
    expect(typeof plain.amount).toBe('string')

    const coerced = createTestMapper({ coerceFn: decimalCoerce })
    const [numberRecord] = await coerced.query<{ amount: number }>(
      `
        SELECT
          '123.45'::numeric::text AS amount
      `,
      []
    )

    expect(numberRecord.amount).toBeCloseTo(123.45)
  })

  it('handles pg primitives (uuid/bool/int/float/double) without breaking', async () => {
    const mapper = createTestMapper()

    const [record] = await mapper.query<{
      invoiceId: string
      active: boolean
      countInt: number
      rateFloat: number
      rateDouble: number
    }>(
      `
        SELECT
          '00000000-0000-0000-0000-000000000000'::uuid AS invoice_id,
          true AS active,
          7::int AS count_int,
          3.14::real AS rate_float,
          2.718281828::double precision AS rate_double
      `,
      []
    )

    expect(record.invoiceId).toBe('00000000-0000-0000-0000-000000000000')
    expect(record.active).toBe(true)
    expect(typeof record.active).toBe('boolean')
    expect(record.countInt).toBe(7)
    expect(typeof record.countInt).toBe('number')
    expect(record.rateFloat).toBeCloseTo(3.14)
    expect(record.rateDouble).toBeCloseTo(2.718281828)
  })
})
