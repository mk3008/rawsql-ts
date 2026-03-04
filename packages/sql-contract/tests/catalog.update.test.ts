import { describe, expect, it, vi } from 'vitest'
import type { QuerySpec, Rewriter } from '../src'
import { createCatalogExecutor } from '../src'

describe('catalog update execution', () => {
  it('rejects update specs without a WHERE clause by default', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('UPDATE users SET name = :name')) }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<{ name: string }, never> = {
      id: 'mutation.update.no-where',
      sqlFile: 'update.sql',
      params: { shape: 'named', example: { name: 'Alice' } },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { name: 'Alice' })).rejects.toThrow(
      /requires a WHERE clause/i
    )
    expect(executor).not.toHaveBeenCalled()
  })

  it('rejects missing WHERE params for updates but allows null', async () => {
    const loader = {
      load: vi.fn(
        () => Promise.resolve('UPDATE users SET name = :name WHERE id = :id')
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<{ name: string; id: number | null }, never> = {
      id: 'mutation.update.where-param',
      sqlFile: 'update-where.sql',
      params: { shape: 'named', example: { name: 'Alice', id: 1 } },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { name: 'Alice' } as any)).rejects.toThrow(
      /required WHERE parameter ":id"/
    )
    expect(executor).not.toHaveBeenCalled()
    await expect(
      catalog.list(spec, { name: 'Alice', id: undefined } as any)
    ).rejects.toThrow(/required WHERE parameter ":id"/)
    expect(executor).not.toHaveBeenCalled()

    await expect(
      catalog.list(spec, { name: 'Alice', id: null })
    ).resolves.toEqual([])
    expect(executor).toHaveBeenCalledTimes(1)
  })

  it('drops a subtractable assignment when the key is missing', async () => {
    const loader = {
      load: vi.fn(
        () =>
          Promise.resolve(
            'UPDATE users SET name = :name, bio = :bio, updated_at = NOW() WHERE id = :id'
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
      id: 'mutation.update.subtract',
      sqlFile: 'update-subtract.sql',
      params: {
        shape: 'named',
        example: { name: 'Alice', bio: 'Hello', id: 1 },
      },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await catalog.list(spec, { bio: 'Hello', id: 1 })

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'UPDATE users SET bio = :bio, updated_at = NOW() WHERE id = :id',
      { bio: 'Hello', id: 1 }
    )
  })

  it('drops a subtractable assignment when the value is undefined', async () => {
    const loader = {
      load: vi.fn(
        () =>
          Promise.resolve(
            'UPDATE users SET name = :name, bio = :bio, updated_at = NOW() WHERE id = :id'
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
      id: 'mutation.update.subtract.undefined',
      sqlFile: 'update-subtract-undefined.sql',
      params: {
        shape: 'named',
        example: { name: 'Alice', bio: 'Hello', id: 1 },
      },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await catalog.list(spec, { name: undefined, bio: 'Hello', id: 1 })

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'UPDATE users SET bio = :bio, updated_at = NOW() WHERE id = :id',
      { bio: 'Hello', id: 1 }
    )
  })

  it('keeps subtractable assignments when the value is null', async () => {
    const loader = {
      load: vi.fn(
        () =>
          Promise.resolve(
            'UPDATE users SET name = :name, bio = :bio, updated_at = NOW() WHERE id = :id'
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
      id: 'mutation.update.subtract.null',
      sqlFile: 'update-subtract-null.sql',
      params: {
        shape: 'named',
        example: { name: 'Alice', bio: 'Hello', id: 1 },
      },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await catalog.list(spec, { name: null, bio: 'Hello', id: 1 })

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'UPDATE users SET name = :name, bio = :bio, updated_at = NOW() WHERE id = :id',
      { name: null, bio: 'Hello', id: 1 }
    )
  })

  it('does not subtract comment-interleaved assignments', async () => {
    const loader = {
      load: vi.fn(
        () =>
          Promise.resolve(
            'UPDATE users SET name = /*c*/ :name, updated_at = NOW() WHERE id = :id'
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
      id: 'mutation.update.comment-non-target',
      sqlFile: 'update-comment.sql',
      params: { shape: 'named', example: { name: 'Alice', id: 1 } },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await catalog.list(spec, { name: undefined, id: 1 })

    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'UPDATE users SET name = /*c*/ :name, updated_at = NOW() WHERE id = :id',
      { name: undefined, id: 1 }
    )
  })

  it('does not subtract composite right-hand sides', async () => {
    const loader = {
      load: vi.fn(
        () =>
          Promise.resolve(
            'UPDATE users SET name = coalesce(:name, name) WHERE id = :id'
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
      id: 'mutation.update.composite-non-target',
      sqlFile: 'update-composite.sql',
      params: { shape: 'named', example: { name: 'Alice', id: 1 } },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { id: 1 })).resolves.toEqual([])
    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'UPDATE users SET name = coalesce(:name, name) WHERE id = :id',
      { id: 1 }
    )
  })

  it('rejects updates whose SET clause becomes empty after subtraction', async () => {
    const loader = {
      load: vi.fn(
        () => Promise.resolve('UPDATE users SET name = :name, bio = :bio WHERE id = :id')
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.update.empty-set',
      sqlFile: 'update-empty-set.sql',
      params: {
        shape: 'named',
        example: { name: 'Alice', bio: 'Hello', id: 1 },
      },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { id: 1 })).rejects.toThrow(
      /removed every SET assignment/i
    )
    expect(executor).not.toHaveBeenCalled()
  })

  it('does not treat a following statement WHERE as part of the update statement', async () => {
    const loader = {
      load: vi.fn(
        () => Promise.resolve('UPDATE users SET name = :name; SELECT * FROM users WHERE id = :id')
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.update.statement-boundary.where',
      sqlFile: 'update-statement-boundary.sql',
      params: { shape: 'named', example: { name: 'Alice', id: 1 } },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { name: 'Alice', id: 1 })).rejects.toThrow(
      /requires a WHERE clause/i
    )
    expect(executor).not.toHaveBeenCalled()
  })
  it('rejects mutation specs that use non-safe rewriters', async () => {
    const loader = {
      load: vi.fn(
        () => Promise.resolve('UPDATE users SET name = :name WHERE id = :id')
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const unsafeRewriter: Rewriter = {
      name: 'plain-rewriter',
      rewrite: ({ sql, params }) => ({ sql, params }),
    }
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
      rewriters: [unsafeRewriter],
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.rewriter.unsafe',
      sqlFile: 'update-rewriter.sql',
      params: { shape: 'named', example: { name: 'Alice', id: 1 } },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { name: 'Alice', id: 1 })).rejects.toThrow(
      /not allowed for mutation preprocessing/i
    )
    expect(executor).not.toHaveBeenCalled()
  })

  it('allows mutation specs with mutationSafety: "safe" rewriters', async () => {
    const loader = {
      load: vi.fn(
        () => Promise.resolve('UPDATE users SET name = :name WHERE id = :id')
      ),
    }
    const executor = vi.fn(() => Promise.resolve([]))
    const safeRewriter: Rewriter & { mutationSafety: 'safe' } = {
      name: 'safe',
      mutationSafety: 'safe',
      rewrite: ({ sql, params }) => ({ sql, params }),
    }
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
      rewriters: [safeRewriter],
    })

    const spec: QuerySpec<Record<string, unknown>, never> = {
      id: 'mutation.rewriter.safe',
      sqlFile: 'update-rewriter-safe.sql',
      params: { shape: 'named', example: { name: 'Alice', id: 1 } },
      mutation: {
        kind: 'update',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { name: 'Alice', id: 1 })).resolves.toEqual(
      []
    )
    expect(executor).toHaveBeenCalledTimes(1)
  })
})

