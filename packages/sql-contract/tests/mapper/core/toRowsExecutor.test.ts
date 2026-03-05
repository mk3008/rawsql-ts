import { describe, expect, it } from 'vitest'
import { toRowsExecutor } from '@rawsql-ts/sql-contract/mapper'

describe('toRowsExecutor', () => {
  it('preserves rowCount when wrapping a function executor', async () => {
    const executor = toRowsExecutor(async () => ({
      rows: [{ id: 1 }],
      rowCount: 1,
    }))

    await expect(executor('select 1', [])).resolves.toEqual({
      rows: [{ id: 1 }],
      rowCount: 1,
    })
  })

  it('preserves rowCount when wrapping an object method executor', async () => {
    const target = {
      run: async () => ({
        rows: [{ id: 2 }],
        rowCount: 1,
      }),
    }
    const executor = toRowsExecutor(target, 'run')

    await expect(executor('select 1', [])).resolves.toEqual({
      rows: [{ id: 2 }],
      rowCount: 1,
    })
  })
})
