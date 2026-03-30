import { describe, expect, test } from 'vitest'
import {
  queryExactlyOneRow,
  queryManyRows,
  queryScalarExactlyOne,
  queryZeroOrOneRow,
  type QueryExecutor
} from '../../../src/mapper'

describe('cardinality contracts', () => {
  test('queryExactlyOneRow accepts array-based executors', async () => {
    const executor: QueryExecutor = async () => [{ id: 1 }]

    await expect(queryExactlyOneRow<{ id: number }>(executor, 'select 1', [])).resolves.toEqual({ id: 1 })
  })

  test('queryZeroOrOneRow returns undefined when no rows are present', async () => {
    const executor: QueryExecutor = async () => ({ rows: [] })

    await expect(queryZeroOrOneRow<{ id: number }>(executor, 'select 1', [])).resolves.toBeUndefined()
  })

  test('queryManyRows returns all normalized rows', async () => {
    const executor: QueryExecutor = async () => ({ rows: [{ id: 1 }, { id: 2 }] })

    await expect(queryManyRows<{ id: number }>(executor, 'select 1', [])).resolves.toEqual([
      { id: 1 },
      { id: 2 }
    ])
  })

  test('queryScalarExactlyOne reads one scalar value', async () => {
    const executor: QueryExecutor = async () => ({ rows: [{ id: 'user-1' }] })

    await expect(queryScalarExactlyOne<string>(executor, 'select 1', [], { label: 'users/insert' })).resolves.toBe('user-1')
  })

  test('queryExactlyOneRow reports label-aware cardinality failures', async () => {
    const executor: QueryExecutor = async () => ({ rows: [{ id: 1 }, { id: 2 }] })

    await expect(
      queryExactlyOneRow<{ id: number }>(executor, 'select 1', [], { label: 'users-insert/queryspec' })
    ).rejects.toThrow(/Expected exactly one row for users-insert\/queryspec/i)
  })
})
