import path from 'node:path'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createMapperFromExecutor,
  MapperOptions,
  toRowsExecutor,
} from '@rawsql-ts/sql-contract/mapper'

let SQL: typeof initSqlJs | undefined
let db: SqlJsDatabase | undefined

const ensureDb = (): SqlJsDatabase => {
  if (!db) {
    throw new Error('SQLite database is not ready')
  }
  return db
}

const convertResults = (results: ReturnType<SqlJsDatabase['exec']>) => {
  if (!results || results.length === 0) {
    return []
  }
  const { columns, values } = results[0]
  return values.map((row) => {
    const record: Record<string, unknown> = {}
    columns.forEach((column, index) => {
      record[column] = row[index]
    })
    return record
  })
}

const createTestReader = (options?: MapperOptions) => {
  const executor = toRowsExecutor((sql) => {
    const results = ensureDb().exec(sql)
    return convertResults(results)
  })
  return createMapperFromExecutor(executor, options)
}

beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: (filename) =>
      path.join(
        path.dirname(require.resolve('sql.js/package.json')),
        'dist',
        filename,
      ),
  })
  db = new SQL.Database()
})

afterAll(() => {
  db?.close()
})

const decimalCoerce: MapperOptions['coerceFn'] = ({ value }) => {
  if (typeof value !== 'string') {
    return value
  }
  if (!value.includes('.') || Number.isNaN(Number(value))) {
    return value
  }
  return Number(value)
}

describe('reader driver integration (sqlite)', () => {
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

  it('keeps strings unchanged when coerceDates is disabled', async () => {
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

  it('handles sqlite primitives (bool/int/float/double) without breaking', async () => {
    const reader = createTestReader()

    const [record] = await reader.query<{
      active: number
      countInt: number
      rateFloat: number
      rateDouble: number
    }>(
      `
        SELECT
          1 AS active,
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
