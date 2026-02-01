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
  createReader,
  mapperPresets,
  MapperOptions,
  type Mapper,
  type Row,
  toRowsExecutor,
} from '@rawsql-ts/sql-contract/mapper'
import { driverDescribe } from './driver-describe'

let container: StartedPostgreSqlContainer | undefined
let client: Client | undefined
let baseReader: Mapper | undefined
let readerWithoutDateCoerce: Mapper | undefined
let readerWithDecimalCoerce: Mapper | undefined

const ensureClient = (): Client => {
  if (!client) {
    throw new Error('Postgres client is not ready')
  }
  return client
}

const decimalCoerce: MapperOptions['coerceFn'] = ({ value }) => {
  if (typeof value !== 'string') {
    return value
  }
  if (!value.includes('.') || Number.isNaN(Number(value))) {
    return value
  }
  return Number(value)
}

const ensureBaseReader = (): Mapper => {
  if (!baseReader) {
    throw new Error('Base reader is not initialized')
  }
  return baseReader
}

const ensureReaderWithoutDateCoerce = (): Mapper => {
  if (!readerWithoutDateCoerce) {
    throw new Error('No reader without date coercion is available')
  }
  return readerWithoutDateCoerce
}

const ensureReaderWithDecimalCoerce = (): Mapper => {
  if (!readerWithDecimalCoerce) {
    throw new Error('No decimal reader is available')
  }
  return readerWithDecimalCoerce
}

const normalizeIsoString = (
  value: Date | string | null | undefined
): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Cannot normalize to ISO string: ${value}`)
    }
    return parsed.toISOString()
  }
  throw new Error('Value is not a Date or string')
}

const normalizeNumericString = (value: string | number): string =>
  typeof value === 'number' ? value.toString() : value

driverDescribe('reader driver integration (pg)', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start()
    client = new Client({
      connectionString: container.getConnectionUri(),
    })
    await client.connect()
    await ensureClient().query("SET TIME ZONE 'UTC'")

    const executor = toRowsExecutor(async (sql, params): Promise<Row[]> => {
      const values = Array.isArray(params) ? params : []
      const result = await ensureClient().query(sql, values)
      return result.rows as Row[]
    })
    const basePreset = mapperPresets.appLike()
    baseReader = createReader(executor, basePreset)
    readerWithoutDateCoerce = createReader(executor, {
      ...basePreset,
      coerceDates: false,
      coerceFn: basePreset.coerceFn,
    })
    readerWithDecimalCoerce = createReader(executor, {
      ...basePreset,
      coerceFn: decimalCoerce,
    })
  }, 120000)

  afterAll(async () => {
    await client?.end()
    await container?.stop()
  })

  it('coerceDates transforms text/timestamp/timestamptz columns into Date', async () => {
    const reader = ensureBaseReader()

    const [record] = await reader.query<{
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
    const reader = ensureReaderWithoutDateCoerce()

    const [record] = await reader.query<{ issuedAtText: string }>(
      `
        SELECT
          '2025-01-15T09:00:00+00:00'::text AS issued_at_text
      `,
      []
    )

    expect(normalizeIsoString(record.issuedAtText)).toBe(
      '2025-01-15T09:00:00.000Z'
    )
  })

  it('leaves numeric strings untouched unless a custom coerceFn runs', async () => {
    const reader = ensureBaseReader()

    const [plain] = await reader.query<{ amount: string }>(
      `
        SELECT
          '123.45'::numeric::text AS amount
      `,
      []
    )

    expect(normalizeNumericString(plain.amount)).toBe('123.45')

    const coercedReader = ensureReaderWithDecimalCoerce()
    const [numberRecord] = await coercedReader.query<{ amount: number }>(
      `
        SELECT
          '123.45'::numeric::text AS amount
      `,
      []
    )

    expect(numberRecord.amount).toBeCloseTo(123.45)
  })

  it('handles pg primitives (uuid/bool/int/float/double) without breaking', async () => {
    const reader = ensureBaseReader()

    const [record] = await reader.query<{
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
