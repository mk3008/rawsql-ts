import mysql from 'mysql2/promise'
import {
  MySqlContainer,
  StartedMySqlContainer,
} from '@testcontainers/mysql'
import { afterAll, beforeAll, expect, it } from 'vitest'
import {
  createMapperFromExecutor,
  MapperOptions,
  type Row,
  toRowsExecutor,
} from '@rawsql-ts/sql-contract/mapper'
import { driverDescribe } from './driver-describe'

let container: StartedMySqlContainer | undefined
let connection: mysql.Connection | undefined

const ensureConnection = (): mysql.Connection => {
  if (!connection) {
    throw new Error('MySQL connection is not ready')
  }
  return connection
}

const createTestReader = (options?: MapperOptions) => {
  const executor = toRowsExecutor(async (sql, params): Promise<Row[]> => {
    const [rows] = await ensureConnection().execute(sql, params)
    return Array.isArray(rows) ? (rows as Row[]) : []
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

driverDescribe('reader driver integration (mysql)', () => {
  beforeAll(async () => {
    container = await new MySqlContainer('mysql:8.0').start()
    connection = await mysql.createConnection({
      uri: container.getConnectionUri(),
      timezone: 'Z',
    })
  }, 120000)

  afterAll(async () => {
    await connection?.end()
    await container?.stop()
  })

  it('coerceDates converts ISO strings into Date when enabled', async () => {
    const reader = createTestReader({ coerceDates: true })

    const [record] = await reader.query<{
      issuedAtText: Date
      issuedAtDatetime: Date
    }>(
      `
        SELECT
          '2025-01-15T09:00:00+00:00' AS issued_at_text,
          CAST('2025-01-15 09:00:00' AS datetime) AS issued_at_datetime
      `,
      [],
    )

    expect(record.issuedAtText).toBeInstanceOf(Date)
    expect(record.issuedAtText.toISOString()).toBe(
      '2025-01-15T09:00:00.000Z',
    )
    expect(record.issuedAtDatetime).toBeInstanceOf(Date)
    expect(record.issuedAtDatetime.toISOString()).toBe(
      '2025-01-15T09:00:00.000Z',
    )
  })

  it('keeps strings intact when coerceDates is disabled', async () => {
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

  it('leaves numeric strings unchanged unless a custom coerceFn runs', async () => {
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

  it('handles mysql primitives (bool/int/float/double) without breaking', async () => {
    const reader = createTestReader()

    const [record] = await reader.query<{
      active: number
      countInt: number
      rateFloat: number
      rateDouble: number
    }>(
      `
        SELECT
          true AS active,
          7 AS count_int,
          3.14 AS rate_float,
          2.718281828 AS rate_double
      `,
      [],
    )

    expect(record.active).toBe(1)
    expect(typeof record.active).toBe('number')
    expect(record.countInt).toBe(7)
    expect(record.rateFloat).toBeCloseTo(3.14)
    expect(record.rateDouble).toBeCloseTo(2.718281828)
  })
})
