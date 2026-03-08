import { describe, expect, it, vi } from 'vitest'
import type { MutationAwareRewriter, QuerySpec, Rewriter } from '../src'
import { createCatalogExecutor } from '../src'

describe('catalog delete execution', () => {
  it('rejects delete specs without a WHERE clause by default', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('DELETE FROM users')) }
    const executor = vi.fn(() => Promise.resolve({ rows: [], rowCount: 1 }))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<{ id: number }, never> = {
      id: 'mutation.delete.no-where',
      sqlFile: 'delete.sql',
      params: { shape: 'named', example: { id: 1 } },
      mutation: {
        kind: 'delete',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { id: 1 })).rejects.toThrow(
      /requires a WHERE clause/i
    )
    expect(executor).not.toHaveBeenCalled()
  })

  it('rejects missing WHERE params for deletes but allows null', async () => {
    const loader = {
      load: vi.fn(
        () =>
          Promise.resolve(
            'DELETE FROM users WHERE id = :id AND tenant_id = :tenant_id'
          )
      ),
    }
    const executor = vi.fn(() => Promise.resolve({ rows: [], rowCount: 1 }))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<
      { id: number; tenant_id: number | null | undefined },
      never
    > = {
      id: 'mutation.delete.where-param',
      sqlFile: 'delete-where.sql',
      params: { shape: 'named', example: { id: 1, tenant_id: 10 } },
      mutation: {
        kind: 'delete',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { id: 1 } as any)).rejects.toThrow(
      /required WHERE parameter ":tenant_id"/
    )
    expect(executor).not.toHaveBeenCalled()

    await expect(
      catalog.list(spec, { id: 1, tenant_id: undefined } as any)
    ).rejects.toThrow(/required WHERE parameter ":tenant_id"/)
    expect(executor).not.toHaveBeenCalled()

    await expect(
      catalog.list(spec, { id: 1, tenant_id: null })
    ).resolves.toEqual([])
    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'DELETE FROM users WHERE id = :id AND tenant_id = :tenant_id',
      { id: 1, tenant_id: null }
    )
  })

  it('allows mutation specs when every rewriter declares mutation safety', async () => {
    const loader = {
      load: vi.fn(
        () => Promise.resolve('DELETE FROM users WHERE id = :id')
      ),
    }
    const executor = vi.fn(() => Promise.resolve({ rows: [], rowCount: 1 }))
    const safeRewriter: MutationAwareRewriter & Rewriter = {
      name: 'safe-rewriter',
      mutationSafety: 'safe',
      rewrite: ({ sql, params }) => ({ sql: `${sql} -- audited`, params }),
    }
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
      rewriters: [safeRewriter],
    })

    const spec: QuerySpec<{ id: number }, never> = {
      id: 'mutation.rewriter.safe',
      sqlFile: 'delete-safe.sql',
      params: { shape: 'named', example: { id: 1 } },
      mutation: {
        kind: 'delete',
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { id: 1 })).resolves.toEqual([])
    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'DELETE FROM users WHERE id = :id -- audited',
      { id: 1 }
    )
  })

  it('enforces delete affected-row guards from rowCount', async () => {
    const loader = {
      load: vi.fn(() => Promise.resolve('DELETE FROM users WHERE id = :id')),
    }
    const spec: QuerySpec<{ id: number }, never> = {
      id: 'mutation.delete.guard',
      sqlFile: 'delete-guard.sql',
      params: { shape: 'named', example: { id: 1 } },
      mutation: {
        kind: 'delete',
      },
      output: {
        example: undefined as never,
      },
    }

    const createDeleteCatalog = (rowCount?: number) => {
      const executor = vi.fn(() =>
        Promise.resolve(
          rowCount === undefined ? { rows: [] } : { rows: [], rowCount }
        )
      )
      const catalog = createCatalogExecutor({
        loader,
        executor,
        allowNamedParamsWithoutBinder: true,
      })

      return { catalog, executor }
    }

    const ng0 = createDeleteCatalog(0)
    await expect(ng0.catalog.list(spec, { id: 1 })).rejects.toThrow(
      /expected exactly 1 affected row but received 0/i
    )
    expect(ng0.executor).toHaveBeenCalledTimes(1)
    const ok = createDeleteCatalog(1)
    await expect(ok.catalog.list(spec, { id: 1 })).resolves.toEqual([])
    expect(ok.executor).toHaveBeenCalledTimes(1)
    expect(ok.executor).toHaveBeenCalledWith(
      'DELETE FROM users WHERE id = :id',
      { id: 1 }
    )
    const ng2 = createDeleteCatalog(2)
    await expect(ng2.catalog.list(spec, { id: 1 })).rejects.toThrow(
      /expected exactly 1 affected row but received 2/i
    )
    expect(ng2.executor).toHaveBeenCalledTimes(1)
    const ngUnknown = createDeleteCatalog()
    await expect(ngUnknown.catalog.list(spec, { id: 1 })).rejects.toThrow(
      /did not expose rowCount/i
    )
    expect(ngUnknown.executor).toHaveBeenCalledTimes(1)
  })

  it('allows delete specs to disable affected-row guards explicitly', async () => {
    const loader = {
      load: vi.fn(() => Promise.resolve('DELETE FROM users WHERE id = :id')),
    }
    const executor = vi.fn(() => Promise.resolve({ rows: [] }))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<{ id: number }, never> = {
      id: 'mutation.delete.guard-none',
      sqlFile: 'delete-guard-none.sql',
      params: { shape: 'named', example: { id: 1 } },
      mutation: {
        kind: 'delete',
        delete: {
          affectedRowsGuard: { mode: 'none' },
        },
      },
      output: {
        example: undefined as never,
      },
    }

    await expect(catalog.list(spec, { id: 1 })).resolves.toEqual([])
    expect(executor).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledWith(
      'DELETE FROM users WHERE id = :id',
      { id: 1 }
    )
  })
})
