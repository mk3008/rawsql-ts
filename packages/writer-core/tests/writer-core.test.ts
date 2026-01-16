import { describe, expect, test } from 'vitest'
import { insert, remove, update } from '@rawsql-ts/writer-core'

describe('writer-core helpers', () => {
test('insert emits visible SQL with simple table string', () => {
    // undefined fields are dropped so SQL only names present columns.
    const result = insert('users', {
      name: 'alice',
      nickname: undefined,
      age: 30,
    })

    expect(result.sql).toBe('INSERT INTO users (name, age) VALUES ($1, $2)')
    expect(result.params).toEqual(['alice', 30])
  })

  test('update accepts key object for WHERE and reuses simple params', () => {
    const result = update(
      'users',
      { name: 'bobby', age: undefined, status: 'active' },
      { id: 3 },
    )

    expect(result.sql).toBe('UPDATE users SET name = $1, status = $2 WHERE id = $3')
    expect(result.params).toEqual(['bobby', 'active', 3])
  })

  test('update handles composite keys by AND-ing equality clauses', () => {
    const result = update(
      'user_roles',
      { status: 'active' },
      { user_id: 10, role_id: 2 },
    )

    expect(result.sql).toBe(
      'UPDATE user_roles SET status = $1 WHERE user_id = $2 AND role_id = $3',
    )
    expect(result.params).toEqual(['active', 10, 2])
  })

  test('remove emits delete with equality-only WHERE from key object', () => {  
    const result = remove('users', { id: 3, tenant_id: 10 })

    expect(result.sql).toBe('DELETE FROM users WHERE id = $1 AND tenant_id = $2')
    expect(result.params).toEqual([3, 10])
  })

  test('insert rejects invalid column identifiers', () => {
    expect(() =>
      insert('users', {
        'bad-column!': 'value',
      }),
    ).toThrow('column identifier "bad-column!" must match /^[A-Za-z_][A-Za-z0-9_]*$/')
  })

  test('insert rejects invalid table identifiers', () => {
    expect(() =>
      insert('bad-table!', { name: 'value' }),
    ).toThrow('table identifier "bad-table!" must match /^[A-Za-z_][A-Za-z0-9_]*$/')
  })

  test('update rejects invalid table identifiers', () => {
    expect(() =>
      update('bad-table!', { status: 'active' }, { id: 1 }),
    ).toThrow('table identifier "bad-table!" must match /^[A-Za-z_][A-Za-z0-9_]*$/')
  })

  test('remove rejects empty key column identifiers', () => {
    expect(() => remove('users', { '': 1 })).toThrow(
      'column identifier "" must match /^[A-Za-z_][A-Za-z0-9_]*$/',
    )
  })

  test('remove rejects invalid table identifiers', () => {
    expect(() => remove('bad-table!', { id: 1 })).toThrow(
      'table identifier "bad-table!" must match /^[A-Za-z_][A-Za-z0-9_]*$/',
    )
  })
})

test('usage story highlights table names as strings and SQL readability', () => {
  // Demonstrate a typical CUD flow with visible SQL and plain table names.
  const insertSql = insert('users', { email: 'writer@example.com', bio: undefined })
  const updateSql = update('users', { display_name: 'Writer Core' }, { email: 'writer@example.com' })

  expect(insertSql.sql).toContain('INSERT INTO users')
  expect(insertSql.params).toEqual(['writer@example.com'])
  expect(updateSql.sql).toContain('UPDATE users SET display_name = $1')
  expect(updateSql.params).toEqual(['Writer Core', 'writer@example.com'])
})

test('writer-core does not coerce param values', () => {
  const occurredAt = new Date()
  const eventId = 1n

  const result = insert('events', { occurred_at: occurredAt, event_id: eventId })

  expect(result.params[0]).toBe(occurredAt)
  expect(result.params[1]).toBe(eventId)
})

test('update throws when no values remain before WHERE', () => {
  expect(() =>
    update('users', { name: undefined, age: undefined }, { id: 1 }),
  ).toThrow('update values must not be empty')
})

test('remove throws when no key columns are provided', () => {
  expect(() => remove('users', {})).toThrow('where must not be empty')
})
