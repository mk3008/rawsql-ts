import { describe, expect, it } from 'vitest'
import { createMapper, mapSimpleRows, mapperPresets } from '@rawsql-ts/sql-contract/mapper'

type UserDto = {
  id: string
  displayName: string
}

type DuckNormalizationSpec = {
  id: string
  displayValue: string
  displayName: string
  userAddress: string
}

const decimalToNumber = ({
  key,
  value,
}: {
  key: string
  sourceKey: string
  value: unknown
}) => (key === 'amount' && typeof value === 'string' ? Number(value) : value)

describe('mapper simple mapping', () => {
  it('shows the simplest createMapper + query usage for docs', async () => {
    const rows = [
      {
        id: 1,
        display_name: 'Alice',
      },
    ]

    const mapper = createMapper(async () => rows)
    const [user] = await mapper.query<UserDto>('SELECT ...', [])

    expect(user.id).toBe('1')
    expect(user.displayName).toBe('Alice')
  })

  it('documents duck typing defaults (normalization + coercion)', async () => {
    const rows = [
      {
        USER_ID: 10,
        display_name: 'Doc',
        amount: '42',
      },
    ]

    const mapper = createMapper(async () => rows)
    const attempts: Array<{
      key: string
      sourceKey: string
      value: unknown
    }> = []

    const [doc] = await mapper.query<
      { userId: string; displayName: string; amount: number }
    >('SELECT ...', [], {
      coerceFn: ({ key, sourceKey, value }) => {
        attempts.push({ key, sourceKey, value })
        return key === 'amount' && typeof value === 'string'
          ? Number(value)
          : value
      },
    })

    expect(doc.userId).toBe('10')
    expect(doc.displayName).toBe('Doc')
    expect(doc.amount).toBe(42)
    expect(
      attempts.some(
        (attempt) => attempt.key === 'userId' && attempt.sourceKey === 'USER_ID'
      )
    ).toBe(true)
    expect(
      attempts.some(
        (attempt) =>
          attempt.key === 'displayName' &&
          attempt.sourceKey === 'display_name'
      )
    ).toBe(true)
  })

  describe('explicit presets', () => {
    it('uses the safe preset to avoid key transforms and date coercion', async () => {
      const rows = [
        {
          invoice_id: 1,
          issued_at: '2025-01-01T00:00:00Z',
        },
      ]

      const mapper = createMapper(async () => rows, mapperPresets.safe())
      const [record] = await mapper.query<{
        invoice_id: number
        issued_at: string
      }>('SELECT ...', [])

      expect(record.invoice_id).toBe(1)
      expect(record.issued_at).toBe('2025-01-01T00:00:00Z')
      expect(typeof record.issued_at).toBe('string')
    })

    it('uses the appLike preset to enable camelCase keys and date coercion', async () => {
      const rows = [
        {
          issued_at: '2025-01-01T00:00:00Z',
        },
      ]

      const mapper = createMapper(async () => rows, mapperPresets.appLike())
      const [record] = await mapper.query<{ issuedAt: Date }>('SELECT ...', [])

      expect(record.issuedAt).toBeInstanceOf(Date)
      expect(record.issuedAt.toISOString()).toBe('2025-01-01T00:00:00.000Z')
    })
  })

  describe('default normalization behaviors', () => {
    it('maps snake_case scalars to camelCase and stringifies identifier columns by default', async () => {
      const rows = [
        {
          invoice_id: 101,
          customer_id: 5,
          active: true,
          uuid: '0000-0000-0000',
          count_int: 7,
          rate_double: 3.14,
        },
      ]

      const mapper = createMapper(async () => rows)
      const [record] = await mapper.query<{
        invoiceId: string
        customerId: string
        active: boolean
        uuid: string
        countInt: number
        rateDouble: number
      }>('SELECT ...', [])

      expect(record.invoiceId).toBe('101')
      expect(record.customerId).toBe('5')
      expect(record.active).toBe(true)
      expect(record.uuid).toBe('0000-0000-0000')
      expect(record.countInt).toBe(7)
      expect(typeof record.countInt).toBe('number')
      expect(record.rateDouble).toBeCloseTo(3.14)
    })

    it('keeps payloads intact when no coercion is requested', async () => {
      const payload = { nested: true }
      const rows = [
        {
          invoice_id: 1,
          payload,
        },
      ]

      const mapper = createMapper(async () => rows)
      const [record] = await mapper.query<{
        invoiceId: string
        payload: { nested: boolean }
      }>('SELECT ...', [])

      expect(record.invoiceId).toBe('1')
      expect(record.payload).toBe(payload)
    })

    it('does not coerce numeric/decimal values by default', async () => {
      const rows = [
        {
          amount: '100.01',
        },
      ]

      const mapper = createMapper(async () => rows)
      const [record] = await mapper.query<{ amount: string }>('SELECT ...', [])

      expect(record.amount).toBe('100.01')
      expect(typeof record.amount).toBe('string')
    })

    it('stringifies identifier columns by default while leaving other keys untouched', async () => {
      const rows = [
        {
          id: 1,
          order_id: 9007199254740993n,
          grid: 3,
        },
      ]

      const mapper = createMapper(async () => rows)
      const [record] = await mapper.query<{
        id: string
        orderId: string
        grid: number
      }>('SELECT ...', [])

      expect(record.id).toBe('1')
      expect(record.orderId).toBe('9007199254740993')
      expect(record.grid).toBe(3)
      expect(typeof record.grid).toBe('number')
    })

    it('stringifies id/userId while keeping userid/grid/identity untouched', async () => {
      const rows = [
        {
          id: 1,
          userId: 2,
          userid: 3,
          grid: 4,
          identity: 5,
        },
      ]

      const mapper = createMapper(async () => rows)
      const [record] = await mapper.query<{
        id: string
        userId: string
        userid: number
        grid: number
        identity: number
      }>('SELECT ...', [])

      expect(record.id).toBe('1')
      expect(record.userId).toBe('2')
      expect(record.userid).toBe(3)
      expect(record.grid).toBe(4)
      expect(record.identity).toBe(5)
      expect(typeof record.identity).toBe('number')
    })

    it('defaults idKeysAsString to true even when mapSimpleRows runs without options', () => {
      const rows = [{ id: 1 }]
      const [dto] = mapSimpleRows<{ id: string }>(rows)
      expect(dto.id).toBe('1')
    })
  })

  describe('opt-in coercion controls', () => {
    it('keeps issuedAt as a string until coerceDates opts in', async () => {
      const rows = [
        {
          issued_at: '2025-01-01T00:00:00Z',
        },
      ]

      const mapper = createMapper(async () => rows)
      const [plain] = await mapper.query<{ issuedAt: string }>('SELECT ...', [])

      expect(plain.issuedAt).toBe('2025-01-01T00:00:00Z')
      expect(typeof plain.issuedAt).toBe('string')

      const [coerced] = await mapper.query<{ issuedAt: Date }>(
        'SELECT ...',
        [],
        { coerceDates: true }
      )

      expect(coerced.issuedAt).toBeInstanceOf(Date)
      expect(coerced.issuedAt.toISOString()).toBe('2025-01-01T00:00:00.000Z')
    })

    it('applies numeric decimal coercion only when explicitly provided via coerceFn', async () => {
      const rows = [
        {
          amount: '123.45',
          other_value: 'keep',
        },
      ]

      const mapper = createMapper(async () => rows)
      const calls: Array<{
        key: string
        sourceKey: string
        value: unknown
      }> = []

      const [record] = await mapper.query<
        { amount: number; otherValue: string }
      >('SELECT ...', [], {
        coerceFn: ({ key, sourceKey, value }) => {
          calls.push({ key, sourceKey, value })
          return decimalToNumber({ key, sourceKey, value })
        },
      })

      expect(record.amount).toBeCloseTo(123.45)
      expect(record.otherValue).toBe('keep')
      expect(
        calls.some((call) => call.key === 'amount' && call.sourceKey === 'amount')
      ).toBe(true)
    })

    it('lets type hints override identifier defaults', async () => {
      const rows = [
        {
          id: '5',
          created_at: '2025-01-01T00:00:00Z',
          active_flag: 'true',
        },
      ]

      const mapper = createMapper(async () => rows)
      const [record] = await mapper.query<{
        id: bigint
        createdAt: Date
        activeFlag: boolean
      }>('SELECT ...', [], {
        typeHints: {
          id: 'bigint',
          createdAt: 'date',
          activeFlag: 'boolean',
        },
      })

      expect(record.id).toBe(BigInt(5))
      expect(record.createdAt).toBeInstanceOf(Date)
      expect(record.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z')
      expect(record.activeFlag).toBe(true)
    })

    it('reports a helpful error when bigint hints receive invalid strings', async () => {
      const rows = [{ id: '1.2' }]
      const mapper = createMapper(async () => rows)

      await expect(
        mapper.query<{ id: bigint }>('SELECT ...', [], {
          typeHints: {
            id: 'bigint',
          },
        })
      ).rejects.toThrow(
        /Type hint 'bigint' failed for "id".*"1.2"/
      )
    })
  })

  describe('fail-fast collisions', () => {
    it('throws when camelCase normalization collides with existing columns', async () => {
      const rows = [
        {
          invoice_id: 1,
          invoiceId: 2,
        },
      ]

      const mapper = createMapper(async () => rows)
      await expect(mapper.query('SELECT ...', [])).rejects.toThrow(
        /conflict|collision|ambiguous/i
      )
    })

    it('throws when snake_case and camelCase variants target the same key', async () => {
      const rows = [
        {
          foo_bar: 1,
          fooBar: 2,
        },
      ]

      const mapper = createMapper(async () => rows)
      await expect(mapper.query('SELECT ...', [])).rejects.toThrow(
        /conflict|collision|ambiguous/i
      )
    })
  })

  describe('mapSimpleRows identifier handling', () => {
    it('stringifies camelCase identifiers when idKeysAsString is true', () => {
      const rows = [{ id: 1n, userId: 2n }]

      const [dto] = mapSimpleRows<{ id: string; userId: string }>(rows, {
        idKeysAsString: true,
      })

      expect(dto.id).toBe('1')
      expect(dto.userId).toBe('2')
    })

    it('leaves userID with uppercase D untouched under defaults', () => {
      const rows = [{ userID: 13n }]

      const [dto] = mapSimpleRows<{ userID: bigint }>(rows)

      expect(dto.userID).toBe(13n)
    })

    it('keeps non-camelCase identifier-like keys untouched when idKeysAsString is true', () => {
      const rows = [{ userid: 3n, grid: 4n, identity: 5n }]

      const [dto] = mapSimpleRows<{
        userid: bigint
        grid: bigint
        identity: bigint
      }>(rows, { idKeysAsString: true })

      expect(dto.userid).toBe(3n)
      expect(dto.grid).toBe(4n)
      expect(dto.identity).toBe(5n)
    })

    it('stringifies camelCase gridId while leaving grid numeric', () => {
      const rows = [{ gridId: 8n, grid: 9n }]

      const [dto] = mapSimpleRows<{ gridId: string; grid: bigint }>(rows)

      expect(dto.gridId).toBe('8')
      expect(dto.grid).toBe(9n)
    })

    it('skips uppercase-leading identifier names when keyTransform is none', () => {
      const rows = [{ OrderId: 6n }]

      const [dto] = mapSimpleRows<{ OrderId: bigint }>(rows, {
        idKeysAsString: true,
        keyTransform: 'none',
      })

      expect(dto.OrderId).toBe(6n)
      expect('orderId' in dto).toBe(false)
    })

    it('lets type hints override idKeysAsString stringification', () => {
      const rows = [{ id: '123' }]

      const [dto] = mapSimpleRows<{ id: bigint }>(rows, {
        idKeysAsString: true,
        typeHints: {
          id: 'bigint',
        },
      })

      expect(dto.id).toBe(BigInt(123))
    })

    it('reports bigint hint failures with property context', () => {
      const rows = [{ id: '1.2' }]

      expect(() =>
        mapSimpleRows<{ id: bigint }>(rows, {
          typeHints: {
            id: 'bigint',
          },
        })
      ).toThrow(/Type hint 'bigint' failed.*"id"/)
    })
  })

  describe('duck typing normalization defaults', () => {
    it('normalizes uppercase/pascal/snake column names into camelCase properties', async () => {
      const rows = [
        {
          ID: 1,
          DISPLAY_VALUE: 'UppercaseValue',
          DisplayName: 'PascalCase',
          user_address: 'snake_case',
        },
      ]

      const mapper = createMapper(async () => rows)
      const [dto] = await mapper.query<DuckNormalizationSpec>('SELECT ...', [])

      expect(dto.id).toBe('1')
      expect(dto.displayValue).toBe('UppercaseValue')
      expect(dto.displayName).toBe('PascalCase')
      expect(dto.userAddress).toBe('snake_case')
    })

    it('throws when duplicate normalized duck-typed columns exist', async () => {
      const rows = [
        {
          id: 2,
          display_name: 'snake',
          DisplayName: 'pascal',
          DISPLAY_NAME: 'uppercase',
        },
      ]

      const mapper = createMapper(async () => rows)
      await expect(mapper.query<UserDto>('SELECT ...', [])).rejects.toThrow(
        /conflict|collision|ambiguous/i
      )
    })
  })

  it('returns undefined from queryOne when no rows arrive', async () => {
    const mapper = createMapper(async () => [])
    const result = await mapper.queryOne<{ foo: number }>('SELECT ...', [])
    expect(result).toBeUndefined()
  })
})
