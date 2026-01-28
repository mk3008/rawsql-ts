import { describe, expect, test } from 'vitest'
import { createWriter, writerPresets } from '@rawsql-ts/sql-contract/writer'
import type { QueryParams } from '@rawsql-ts/sql-contract/writer'

describe('writer factory with presets', () => {
  test('named preset builds object params and executes through executor', async () => {
    const executed: Array<{ sql: string; params: QueryParams }> = []
    const executor = async (sql: string, params: QueryParams) => {
      executed.push({ sql, params })
      return undefined
    }

    const writer = createWriter(
      executor,
      writerPresets.named({
        formatPlaceholder: (paramName) => `$/` + paramName + `/`,
      }),
    )

    const built = writer.build.insert(
      'projects',
      { name: 'Apollo', owner_id: 7 },
      { returning: ['project_id'] },
    )

    expect(built.sql).toBe(
      'INSERT INTO projects (name, owner_id) VALUES ($/name_1/, $/owner_id_2/) RETURNING project_id',
    )
    expect(built.params).toEqual({ name_1: 'Apollo', owner_id_2: 7 })

    await writer.insert('projects', { name: 'Zeus' })

    expect(executed).toHaveLength(1)
    expect(executed[0].sql).toBe('INSERT INTO projects (name) VALUES ($/name_1/)')
    expect(executed[0].params).toEqual({ name_1: 'Zeus' })
  })

  test('default preset emits indexed placeholders', () => {
    const writer = createWriter(async () => undefined)

    const built = writer.build.insert(
      'projects',
      { name: 'Apollo', owner_id: 7 },
      { returning: ['project_id'] },
    )

    expect(built.sql).toBe(
      'INSERT INTO projects (name, owner_id) VALUES ($1, $2) RETURNING project_id',
    )
    expect(built.params).toEqual(['Apollo', 7])
  })

  test('default writer executes insert/update/remove through executor', async () => {
    const executed: Array<{ sql: string; params: QueryParams }> = []
    const executor = async (sql: string, params: QueryParams) => {
      executed.push({ sql, params })
      return undefined
    }

    const writer = createWriter(executor)

    await writer.insert('customers', { name: 'alice', status: 'pending' })
    await writer.update('customers', { status: 'active' }, { id: 42 })
    await writer.remove('customers', { id: 17 })

    expect(executed).toHaveLength(3)

    expect(executed[0]).toEqual({
      sql: 'INSERT INTO customers (name, status) VALUES ($1, $2)',
      params: ['alice', 'pending'],
    })
    expect(executed[1]).toEqual({
      sql: 'UPDATE customers SET status = $1 WHERE id = $2',
      params: ['active', 42],
    })
    expect(executed[2]).toEqual({
      sql: 'DELETE FROM customers WHERE id = $1',
      params: [17],
    })
  })

  test('anonymous preset keeps positional params for updates', () => {
    const writer = createWriter(
      async () => undefined,
      writerPresets.anonymous(),
    )

    const insertBuilt = writer.build.insert(
      'projects',
      { name: 'Apollo' },
      { returning: ['project_id'] },
    )
    expect(insertBuilt.sql).toBe('INSERT INTO projects (name) VALUES (?) RETURNING project_id')
    expect(insertBuilt.params).toEqual(['Apollo'])

    const built = writer.build.update(
      'projects',
      { name: 'Apollo' },
      { project_id: 5 },
    )

    expect(built.sql).toBe('UPDATE projects SET name = ? WHERE project_id = ?')
    expect(built.params).toEqual(['Apollo', 5])
  })
})
