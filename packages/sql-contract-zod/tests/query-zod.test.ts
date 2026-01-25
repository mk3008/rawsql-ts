import { describe, expect, it } from 'vitest'
import { z, ZodError } from 'zod'
import {
  MapperLike,
  queryOneZod,
  queryZod,
  zNumberFromString,
} from '@rawsql-ts/sql-contract-zod'

describe('sql-contract-zod helpers', () => {
  const createMapper = <T>(rows: T[], singleRow?: T): MapperLike => ({
    query: async () => rows,
    queryOne: async () => singleRow ?? rows[0],
  })

  describe('zNumberFromString', () => {
    it('accepts literal numbers, trimmed numeric strings, and decimals', () => {
      expect(zNumberFromString.parse(33)).toBe(33)
      expect(zNumberFromString.parse('33')).toBe(33)
      expect(zNumberFromString.parse(' 33 ')).toBe(33)
      expect(zNumberFromString.parse('33.1')).toBe(33.1)
    })

    it('rejects non-numeric inputs and incompatible types', () => {
      expect(() => zNumberFromString.parse('abc')).toThrow()
      expect(() => zNumberFromString.parse(null)).toThrow()
      expect(() => zNumberFromString.parse(undefined)).toThrow()
      expect(() => zNumberFromString.parse({})).toThrow()
      expect(() => zNumberFromString.parse([])).toThrow()
    })
  })

  describe('queryZod validation', () => {
    it('rethrows ZodError with detailed path information', async () => {
      const mapper = createMapper([{ id: '33' }])
      const schema = z.object({ id: z.number() })

      const execution = queryZod(mapper, schema, 'select 1')
      await expect(execution).rejects.toBeInstanceOf(ZodError)

      const error = (await execution.catch((err) => err)) as ZodError
      expect(error.issues.length).toBeGreaterThan(0)
      expect(error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: [0, 'id'] }),
        ])
      )
    })

    it('allows optional fields to be omitted', async () => {
      const mapper = createMapper([{ id: 5 }])
      const schema = z.object({
        id: z.number(),
        displayName: z.string().optional(),
      })

      const [result] = await queryZod(mapper, schema, 'select 1')
      expect(result).toEqual({ id: 5 })
    })

    it('captures nested object failures with nested paths', async () => {
      const mapper = createMapper([{ profile: { age: 'young' } }])
      const schema = z.object({
        profile: z.object({
          age: z.number(),
        }),
      })

      const execution = queryZod(mapper, schema, 'select profile')
      await expect(execution).rejects.toBeInstanceOf(ZodError)

      const error = (await execution.catch((err) => err)) as ZodError
      expect(error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: [0, 'profile', 'age'] }),
        ])
      )
    })
  })

  describe('queryOneZod expectations', () => {
    it('throws when the mapper returns nothing', async () => {
      const mapper = createMapper([], undefined)
      const schema = z.object({ id: z.number() })

      await expect(queryOneZod(mapper, schema, 'select 1')).rejects.toThrow(
        /queryOneZod expected exactly one row/i
      )
    })

    it('throws when the mapper returns more than one row', async () => {
      const mapper = createMapper([{ id: 1 }, { id: 2 }])
      const schema = z.object({ id: z.number() })

      await expect(queryOneZod(mapper, schema, 'select *')).rejects.toThrow(
        /received 2/i
      )
    })

    it('validates a single row', async () => {
      const mapper = createMapper([{ id: 99 }])
      const schema = z.object({ id: z.number() })

      await expect(queryOneZod(mapper, schema, 'select 1')).resolves.toEqual({
        id: 99,
      })
    })
  })
})
