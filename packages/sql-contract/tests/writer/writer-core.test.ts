import { describe, expect, test } from 'vitest'
import { insert, remove, update } from '@rawsql-ts/sql-contract/writer'
import type { WriterCoreOptions } from '@rawsql-ts/sql-contract/writer'

describe('sql-contract writer helpers', () => {
  describe('basic statements', () => {
    test('insert emits visible SQL with sorted columns', () => {
      const result = insert('users', {
        name: 'alice',
        nickname: undefined,
        age: 30,
      })

      expect(result.sql).toBe('INSERT INTO users (age, name) VALUES ($1, $2)')
      expect(result.params).toEqual([30, 'alice'])
    })

    test('update accepts key object and reuses params', () => {
      const result = update(
        'users',
        { name: 'bobby', age: undefined, status: 'active' },
        { id: 3 },
      )

      expect(result.sql).toBe('UPDATE users SET name = $1, status = $2 WHERE id = $3')
      expect(result.params).toEqual(['bobby', 'active', 3])
    })

    test('update handles composite keys with deterministic order', () => {
      const result = update(
        'user_roles',
        { status: 'active' },
        { user_id: 10, role_id: 2 },
      )

      expect(result.sql).toBe(
        'UPDATE user_roles SET status = $1 WHERE role_id = $2 AND user_id = $3',
      )
      expect(result.params).toEqual(['active', 2, 10])
    })

    test('remove emits delete with equality-only WHERE', () => {
      const result = remove('users', { id: 3, tenant_id: 10 })

      expect(result.sql).toBe('DELETE FROM users WHERE id = $1 AND tenant_id = $2')
      expect(result.params).toEqual([3, 10])
    })

    test('insert appends returning clause with sorted columns and meta', () => {
      const result = insert(
        'users',
        {
          name: 'alice',
          nickname: undefined,
          age: 30,
        },
        { returning: ['name', 'age'] },
      )

      expect(result.sql).toBe('INSERT INTO users (age, name) VALUES ($1, $2) RETURNING age, name')
      expect(result.params).toEqual([30, 'alice'])
      expect(result.meta?.returning).toEqual(['age', 'name'])
    })

    test('update returning keeps WHERE order and exposes meta', () => {
      const result = update(
        'user_roles',
        { status: 'active' },
        { user_id: 10, role_id: 2 },
        { returning: ['status', 'role_id'] },
      )

      expect(result.sql).toBe(
        'UPDATE user_roles SET status = $1 WHERE role_id = $2 AND user_id = $3 RETURNING role_id, status',
      )
      expect(result.params).toEqual(['active', 2, 10])
      expect(result.meta?.returning).toEqual(['role_id', 'status'])
    })

    test('remove supports returning all columns without disturbing WHERE order', () => {
      const result = remove(
        'users',
        { tenant_id: 10, id: 3 },
        { returning: 'all' },
      )

      expect(result.sql).toBe('DELETE FROM users WHERE id = $1 AND tenant_id = $2 RETURNING *')
      expect(result.params).toEqual([3, 10])
      expect(result.meta?.returning).toBe('*')
    })
  })

  describe('validation', () => {
    test('rejects invalid column identifiers', () => {
      expect(() =>
        insert('users', {
          'bad-column!': 'value',
        }),
      ).toThrow(/column identifier/)
    })

    test('rejects unicode table names by default', () => {
      expect(() =>
        insert('ユーザー', { name: 'value' }),
      ).toThrow(/table identifier/)
    })

    test('rejects unicode column names by default', () => {
      expect(() =>
        insert('users', { ユーザー: 'value' }),
      ).toThrow(/column identifier/)
    })

    test('allows unicode identifiers when explicitly unsafe', () => {
      const result = insert(
        'ユーザー',
        {
          ユーザー名: 'value',
        },
        { allowUnsafeIdentifiers: true },
      )

      expect(result.sql).toContain('INSERT INTO ユーザー (ユーザー名)')
      expect(result.params).toEqual(['value'])
    })

    test('rejects invalid table identifiers', () => {
      expect(() =>
        insert('bad-table!', { name: 'value' }),
      ).toThrow(/table identifier/)
    })

    test('rejects invalid table identifiers during update', () => {
      expect(() =>
        update('bad-table!', { status: 'active' }, { id: 1 }),
      ).toThrow(/table identifier/)
    })

    test('returning rejects invalid column identifiers', () => {
      expect(() =>
        insert('users', { name: 'value' }, { returning: ['bad-column!'] }),
      ).toThrow(/column identifier/)
    })

    test('returning rejects unicode columns by default', () => {
      expect(() =>
        insert('users', { name: 'value' }, { returning: ['ユーザー'] }),
      ).toThrow(/column identifier/)
    })

    test('returning rejects non-array values', () => {
      expect(() =>
        insert(
          'users',
          { name: 'value' },
          { returning: 'id' as unknown as WriterCoreOptions['returning'] },
        ),
      ).toThrow('returning must be "all" or an array of column names')
    })

    test('rejects empty key column identifiers', () => {
      expect(() => remove('users', { '': 1 })).toThrow(/identifier must not be empty/)
    })

    test('allows unicode columns when explicitly unsafe', () => {
      const result = update(
        'users',
        { 表示名: 'Writer Core' },
        { id: 1 },
        { allowUnsafeIdentifiers: true },
      )

      expect(result.sql).toContain('表示名 = $1')
      expect(result.params).toEqual(['Writer Core', 1])
    })

    test('returning allows unicode identifiers when explicitly unsafe', () => {
      const result = update(
        'users',
        { status: 'active' },
        { id: 1 },
        { returning: ['表示名'], allowUnsafeIdentifiers: true },
      )

      expect(result.sql).toContain('RETURNING 表示名')
      expect(result.meta?.returning).toEqual(['表示名'])
    })

    test('remove rejects invalid table identifiers', () => {
      expect(() => remove('bad-table!', { id: 1 })).toThrow(/table identifier/)
    })

    test('update throws when no values remain before WHERE', () => {
      expect(() =>
        update('users', { name: undefined, age: undefined }, { id: 1 }),
      ).toThrow(/update values must not be empty/)
    })

    test('remove throws when no key columns are provided', () => {
      expect(() => remove('users', {})).toThrow(/where must not be empty/)
    })
  })

  describe('usage semantics', () => {
    test('usage story highlights table names as strings and visible SQL', () => {
      const insertSql = insert('users', { email: 'writer@example.com', bio: undefined })
      const updateSql = update('users', { display_name: 'Writer Core' }, { email: 'writer@example.com' })

      expect(insertSql.sql).toContain('INSERT INTO users')
      expect(insertSql.params).toEqual(['writer@example.com'])
      expect(updateSql.sql).toContain('UPDATE users SET display_name = $1')
      expect(updateSql.params).toEqual(['Writer Core', 'writer@example.com'])
    })

    test('writer does not coerce param values', () => {
      const occurredAt = new Date()
      const eventId = 1n

      const result = insert('events', { occurred_at: occurredAt, event_id: eventId })

      expect(result.params[0]).toBe(eventId)
      expect(result.params[1]).toBe(occurredAt)
    })
  })

  describe('placeholder styles', () => {
    const insertValues = {
      age: 30,
      name: 'alice',
    }
    const updateValues = {
      name: 'bobby',
      status: 'active',
    }

    test('question style emits anonymous placeholders with deterministic parameter order', () => {
      const options = { placeholderStyle: 'question' }

      const insertResult = insert('users', insertValues, {
        ...options,
        returning: ['name'],
      })
      expect(insertResult.sql).toBe(
        'INSERT INTO users (age, name) VALUES (?, ?) RETURNING name',
      )
      expect(insertResult.params).toEqual([30, 'alice'])

      const updateResult = update(
        'users',
        updateValues,
        { id: 1 },
        { ...options, returning: ['status'] },
      )
      expect(updateResult.sql).toBe(
        'UPDATE users SET name = ?, status = ? WHERE id = ? RETURNING status',
      )
      expect(updateResult.params).toEqual(['bobby', 'active', 1])

      const removeResult = remove(
        'users',
        { id: 1, tenant_id: 2 },
        { ...options, returning: 'all' },
      )
      expect(removeResult.sql).toBe(
        'DELETE FROM users WHERE id = ? AND tenant_id = ? RETURNING *',
      )
      expect(removeResult.params).toEqual([1, 2])
    })

    test('named style mirrors formatter naming and continues numbering across clauses', () => {
      const options = {
        placeholderStyle: 'named',
        namedPlaceholderPrefix: '@',
        namedPlaceholderNamePrefix: 'p',
      }

      const insertResult = insert('users', insertValues, {
        ...options,
        returning: ['name'],
      })
      expect(insertResult.sql).toBe(
        'INSERT INTO users (age, name) VALUES (@p1, @p2) RETURNING name',
      )
      expect(insertResult.params).toEqual([30, 'alice'])

      const updateResult = update(
        'users',
        updateValues,
        { id: 1 },
        { ...options, returning: ['status'] },
      )
      expect(updateResult.sql).toBe(
        'UPDATE users SET name = @p1, status = @p2 WHERE id = @p3 RETURNING status',
      )
      expect(updateResult.params).toEqual(['bobby', 'active', 1])

      const removeResult = remove(
        'users',
        { id: 2, tenant_id: 3 },
        { ...options, returning: ['tenant_id'] },
      )
      expect(removeResult.sql).toBe(
        'DELETE FROM users WHERE id = @p1 AND tenant_id = @p2 RETURNING tenant_id',
      )
      expect(removeResult.params).toEqual([2, 3])
    })
  })
})
