import { describe, expect, it, vi } from 'vitest'
import type { QuerySpec } from '../src'
import { createCatalogExecutor } from '../src'

describe('catalog create execution', () => {
  it('drops an insert column when the named param is missing', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve(
          'INSERT INTO users (id, name, bio, created_at) VALUES (:id, :name, :bio, :created_at)'
        )
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.insert.subtract.missing',
      sqlFile: 'insert.sql',
      params: {
        shape: 'named',
        example: { id: 1, name: 'Alice', bio: 'Hello', created_at: '2026-03-04' },
      },
      mutation: {
        kind: 'insert',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(
      catalog.list(spec, { id: 1, name: 'Alice', bio: 'Hello' })
    ).resolves.toEqual([])

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'INSERT INTO users (id, name, bio) VALUES (:id, :name, :bio)',
      { id: 1, name: 'Alice', bio: 'Hello' }
    )
  })

  it('drops an insert column when the named param value is undefined', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve(
          'INSERT INTO users (id, name, bio, created_at) VALUES (:id, :name, :bio, :created_at)'
        )
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.insert.subtract.undefined',
      sqlFile: 'insert-undefined.sql',
      params: {
        shape: 'named',
        example: { id: 1, name: 'Alice', bio: 'Hello', created_at: '2026-03-04' },
      },
      mutation: {
        kind: 'insert',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(
      catalog.list(spec, {
        id: 1,
        name: 'Alice',
        bio: 'Hello',
        created_at: undefined,
      })
    ).resolves.toEqual([])

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'INSERT INTO users (id, name, bio) VALUES (:id, :name, :bio)',
      { id: 1, name: 'Alice', bio: 'Hello' }
    )
  })

  it('keeps insert columns when the named param value is null', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve(
          'INSERT INTO users (id, name, bio, created_at) VALUES (:id, :name, :bio, :created_at)'
        )
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.insert.subtract.null',
      sqlFile: 'insert-null.sql',
      params: {
        shape: 'named',
        example: { id: 1, name: 'Alice', bio: 'Hello', created_at: '2026-03-04' },
      },
      mutation: {
        kind: 'insert',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(
      catalog.list(spec, {
        id: 1,
        name: 'Alice',
        bio: 'Hello',
        created_at: null,
      })
    ).resolves.toEqual([])

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'INSERT INTO users (id, name, bio, created_at) VALUES (:id, :name, :bio, :created_at)',
      { id: 1, name: 'Alice', bio: 'Hello', created_at: null }
    )
  })

  it('does not rewrite inserts when no column is removed', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve(
          'INSERT INTO users (id, name, bio, created_at) VALUES (:id, :name, :bio, :created_at)'
        )
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.insert.no-subtraction',
      sqlFile: 'insert-no-subtraction.sql',
      params: {
        shape: 'named',
        example: { id: 1, name: 'Alice', bio: 'Hello', created_at: '2026-03-04' },
      },
      mutation: {
        kind: 'insert',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(
      catalog.list(spec, {
        id: 1,
        name: 'Alice',
        bio: 'Hello',
        created_at: '2026-03-04',
      })
    ).resolves.toEqual([])

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'INSERT INTO users (id, name, bio, created_at) VALUES (:id, :name, :bio, :created_at)',
      { id: 1, name: 'Alice', bio: 'Hello', created_at: '2026-03-04' }
    )
  })

  it('rejects inserts whose entire column list is removed', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve('INSERT INTO users (created_at) VALUES (:created_at)')
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.insert.empty-columns',
      sqlFile: 'insert-empty.sql',
      params: {
        shape: 'named',
        example: { created_at: '2026-03-04' },
      },
      mutation: {
        kind: 'insert',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, {})).rejects.toThrow(
      /removed every insert column because all values were undefined\/missing/i
    )
    expect(executor).not.toHaveBeenCalled()
  })

  it('keeps dropped named params when trailing SQL still references them', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve(
          'INSERT INTO users (id, name, bio) VALUES (:id, :name, :bio) ON CONFLICT (id) DO UPDATE SET bio = :bio'
        )
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.insert.trailing-param-ref',
      sqlFile: 'insert-trailing-param.sql',
      params: {
        shape: 'named',
        example: { id: 1, name: 'Alice', bio: 'Hello' },
      },
      mutation: {
        kind: 'insert',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { id: 1, name: 'Alice' })).resolves.toEqual([])

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'INSERT INTO users (id, name) VALUES (:id, :name) ON CONFLICT (id) DO UPDATE SET bio = :bio',
      { id: 1, name: 'Alice' }
    )
  })

  it('keeps dropped named params when trailing SQL uses @ placeholders', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve(
          'INSERT INTO users (id, name, bio) VALUES (:id, :name, :bio) ON CONFLICT (id) DO UPDATE SET bio = @bio'
        )
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.insert.trailing-param-ref.at',
      sqlFile: 'insert-trailing-param-at.sql',
      params: {
        shape: 'named',
        example: { id: 1, name: 'Alice', bio: 'Hello' },
      },
      mutation: {
        kind: 'insert',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { id: 1, name: 'Alice' })).resolves.toEqual([])

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'INSERT INTO users (id, name) VALUES (:id, :name) ON CONFLICT (id) DO UPDATE SET bio = @bio',
      { id: 1, name: 'Alice' }
    )
  })

  it('keeps dropped named params when trailing SQL uses ${name} placeholders', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve(
          'INSERT INTO users (id, name, bio) VALUES (:id, :name, :bio) ON CONFLICT (id) DO UPDATE SET bio = ${bio}'
        )
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.insert.trailing-param-ref.brace',
      sqlFile: 'insert-trailing-param-brace.sql',
      params: {
        shape: 'named',
        example: { id: 1, name: 'Alice', bio: 'Hello' },
      },
      mutation: {
        kind: 'insert',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { id: 1, name: 'Alice' })).resolves.toEqual([])

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'INSERT INTO users (id, name) VALUES (:id, :name) ON CONFLICT (id) DO UPDATE SET bio = ${bio}',
      { id: 1, name: 'Alice' }
    )
  })

  it('does not reject ON CONFLICT target commas inside parentheses', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve(
          'INSERT INTO users (id, name, bio) VALUES (:id, :name, :bio) ON CONFLICT (id, name) DO NOTHING'
        )
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.insert.on-conflict-comma',
      sqlFile: 'insert-on-conflict-comma.sql',
      params: {
        shape: 'named',
        example: { id: 1, name: 'Alice', bio: 'Hello' },
      },
      mutation: {
        kind: 'insert',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { id: 1, name: 'Alice' })).resolves.toEqual([])

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'INSERT INTO users (id, name) VALUES (:id, :name) ON CONFLICT (id, name) DO NOTHING',
      { id: 1, name: 'Alice' }
    )
  })
  it('does not subtract non-target insert values (composite expressions)', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve(
          "INSERT INTO users (name) VALUES (coalesce(:name, 'anonymous'))"
        )
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.insert.composite-non-target',
      sqlFile: 'insert-composite.sql',
      params: {
        shape: 'named',
        example: { name: 'Alice' },
      },
      mutation: {
        kind: 'insert',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(
      catalog.list(spec, { name: undefined })
    ).resolves.toEqual([])

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      "INSERT INTO users (name) VALUES (coalesce(:name, 'anonymous'))",
      { name: undefined }
    )
  })
})

