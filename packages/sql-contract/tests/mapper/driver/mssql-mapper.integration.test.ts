import { ConnectionPool } from 'mssql'
import { GenericContainer, Wait } from 'testcontainers'
import { afterAll, beforeAll, expect, it } from 'vitest'
import {
  createMapperFromExecutor,
  MapperOptions,
  toRowsExecutor,
} from '@rawsql-ts/sql-contract/mapper'
import { driverDescribe } from './driver-describe'

const SA_PASSWORD = 'YourStrong!Passw0rd'
const IMAGE = 'mcr.microsoft.com/mssql/server:2022-latest'

let container: Awaited<ReturnType<GenericContainer['start']>> | undefined
let pool: ConnectionPool | undefined

const ensurePool = (): ConnectionPool => {
  if (!pool) {
    throw new Error('MSSQL connection pool is not ready')
  }
  return pool
}

const createTestReader = (options?: MapperOptions) => {
  const executor = toRowsExecutor(async (sql, _params) => {
    const result = await ensurePool().query(sql)
    return result.recordset
  })
  return createMapperFromExecutor(executor, options)
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

driverDescribe('reader driver integration (mssql)', () => {
  beforeAll(async () => {
    container = await new GenericContainer(IMAGE)
      .withEnvironment({
        ACCEPT_EULA: 'Y',
        SA_PASSWORD,
        MSSQL_SA_PASSWORD: SA_PASSWORD,
        MSSQL_PID: 'Express',
      })
      .withExposedPorts(1433)
      .withWaitStrategy(
        Wait.forLogMessage(/SQL Server is now ready for client connections\./),
      )
      .start()

    pool = await new ConnectionPool({
      server: container.getHost(),
      port: container.getMappedPort(1433),
      user: 'sa',
      password: SA_PASSWORD,
      database: 'master',
      options: {
        trustServerCertificate: true,
      },
    }).connect()
  }, 120000)

  afterAll(async () => {
    await pool?.close()
    await container?.stop()
  })

  it('coerceDates turns ISO text into Date when enabled', async () => {
    const reader = createTestReader({ coerceDates: true })

    const [record] = await reader.query<{ issuedAtText: Date }>(
      `
        SELECT
          '2025-01-15T09:00:00+00:00' AS issued_at_text
      `,
      [],
    )

    expect(record.issuedAtText).toBeInstanceOf(Date)
    expect(record.issuedAtText.toISOString()).toBe(
      '2025-01-15T09:00:00.000Z',
    )
  })

  it('keeps text columns as strings when coerceDates is disabled', async () => {
    const reader = createTestReader()

    const [record] = await reader.query<{ issuedAtText: string }>(
      `
        SELECT
          '2025-01-15T09:00:00+00:00' AS issued_at_text
      `,
      [],
    )

    expect(record.issuedAtText).toBe('2025-01-15T09:00:00+00:00')
    expect(typeof record.issuedAtText).toBe('string')
  })

  it('leaves numeric strings untouched unless a custom coerceFn is provided', async () => {
    const reader = createTestReader()

    const [plain] = await reader.query<{ amount: string }>(
      `
        SELECT
          '123.45' AS amount
      `,
      [],
    )

    expect(plain.amount).toBe('123.45')
    expect(typeof plain.amount).toBe('string')

    const coercedReader = createTestReader({ coerceFn: decimalCoerce })
    const [numberRecord] = await coercedReader.query<{ amount: number }>(
      `
        SELECT
          '123.45' AS amount
      `,
      [],
    )

    expect(numberRecord.amount).toBeCloseTo(123.45)
  })

  it('handles mssql primitives (bool/int/real/float) without breaking', async () => {
    const reader = createTestReader()

    const [record] = await reader.query<{
      active: boolean
      countInt: number
      rateFloat: number
      rateDouble: number
    }>(
      `
        SELECT
          CAST(1 AS bit) AS active,
          CAST(7 AS int) AS count_int,
          CAST(3.14 AS real) AS rate_float,
          CAST(2.718281828 AS float(53)) AS rate_double
      `,
      [],
    )

    expect(record.active).toBe(true)
    expect(typeof record.active).toBe('boolean')
    expect(record.countInt).toBe(7)
    expect(record.rateFloat).toBeCloseTo(3.14)
    expect(record.rateDouble).toBeCloseTo(2.718281828)
  })
})
