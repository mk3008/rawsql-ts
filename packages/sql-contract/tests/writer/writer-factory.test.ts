import { describe, expect, test } from 'vitest'
import {
  createWriterFromExecutor,
  writerPresets,
} from '@rawsql-ts/sql-contract/writer'
import type { QueryParams } from '@rawsql-ts/sql-contract/writer'

describe('writer factory with presets', () => {
  test('named preset builds object params and executes through executor', async () => {
    const executed: Array<{ sql: string; params: QueryParams }> = []
    const executor = async (sql: string, params: QueryParams) => {
      executed.push({ sql, params })
      return undefined
    }

    const writer = createWriterFromExecutor(
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
    const writer = createWriterFromExecutor(async () => undefined)

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

  test('anonymous preset keeps positional params for updates', () => {
    const writer = createWriterFromExecutor(
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
