import { describe, expect, it, vi } from 'vitest'
import type {
  Binder,
  ObservabilityEvent,
  ObservabilitySink,
  QueryStartEvent,
  QuerySpec,
  Rewriter,
} from '../src'
import {
  BinderError,
  CatalogExecutionError,
  ContractViolationError,
  createCatalogExecutor,
  rowMapping,
} from '../src'

describe('catalog executor', () => {
  it('caches SQL loader results while returning mapped rows', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select id from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ id: 1 }]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
    })

    const spec: QuerySpec<[], { id: number }> = {
      id: 'demo.list',
      sqlFile: 'demo.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: { id: 1 },
        validate: (row) => row as { id: number },
      },
    }

    await expect(catalog.list(spec, [])).resolves.toEqual([{ id: 1 }])
    await catalog.list(spec, [])

    expect(loader.load).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledTimes(2)
    expect(executor).toHaveBeenCalledWith('select id from demo', [])
  })

  it('prepopulated sqlCache bypasses loader', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select id from cache')) }
    const executor = vi.fn(() => Promise.resolve([{ id: 1 }]))
    const cache = new Map<string, string>([['demo.sql', 'select id from cache']])
    const catalog = createCatalogExecutor({
      loader,
      executor,
      sqlCache: cache,
    })

    const spec: QuerySpec<[], { id: number }> = {
      id: 'demo.cache',
      sqlFile: 'demo.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: { id: 1 },
      },
    }

    await catalog.list(spec, [])

    expect(loader.load).not.toHaveBeenCalled()
    expect(executor).toHaveBeenCalledWith('select id from cache', [])
  })

  it('honors rewriters and binders before executing SQL', async () => {
    const loader = {
      load: vi.fn(() => Promise.resolve('select value from demo')),
    }
    const executor = vi.fn(() => Promise.resolve([{ value: 'ok' }]))
    const rewriter: Rewriter = {
      name: 'append-rewrite',
      rewrite: ({ sql, params }) => ({
        sql: `${sql} -- rewritten`,
        params,
      }),
    }
    const binder: Binder = {
      name: 'example-binder',
      bind: ({ sql }) => ({
        sql: `${sql} -- bound`,
        params: [42],
      }),
    }

    const catalog = createCatalogExecutor({
      loader,
      executor,
      rewriters: [rewriter],
      binders: [binder],
    })

    const spec: QuerySpec<[], { value: string }> = {
      id: 'demo.rewrite-bind.list',
      sqlFile: 'scalar.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: { value: 'ok' },
        validate: (row) => row as { value: string },
      },
    }

    await catalog.list(spec, [])

    expect(executor).toHaveBeenCalledWith(
      'select value from demo -- rewritten -- bound',
      [42]
    )
  })

  it('applies row mappings before returning list results', async () => {
    const loader = {
      load: vi.fn(() =>
        Promise.resolve('select identifier, label from demo')
      ),
    }
    const executor = vi.fn(() =>
      Promise.resolve([{ identifier: 1, label: 'demo-label' }])
    )
    const catalog = createCatalogExecutor({ loader, executor })

    const mapping = rowMapping<{
      identifier: number
      label: string
    }>({
      name: 'DemoEntity',
      key: 'identifier',
      columnMap: {
        identifier: 'identifier',
        label: 'label',
      },
    })

    const spec: QuerySpec<[], { identifier: number; label: string }> = {
      id: 'demo.mapping',
      sqlFile: 'mapping.sql',
      params: { shape: 'positional', example: [] },
      output: {
        mapping,
        example: { identifier: 1, label: 'demo-label' },
      },
    }

    await expect(catalog.list(spec, [])).resolves.toEqual([
      { identifier: 1, label: 'demo-label' },
    ])
  })

  it('validates scalar values before returning the result', async () => {
    const loader = {
      load: vi.fn(() => Promise.resolve('select count(*) as value from demo')),
    }
    const executor = vi.fn(() => Promise.resolve([{ value: '7' }]))
    const catalog = createCatalogExecutor({ loader, executor })

    const spec: QuerySpec<[], string> = {
      id: 'demo.scalar-validate',
      sqlFile: 'scalar-valid.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: 'converted',
        validate: (value) => {
          return `${String(value)}-converted`
        },
      },
    }

    await expect(catalog.scalar(spec, [])).resolves.toBe('7-converted')
  })

  it('scalar returns value for single row single column', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select value from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ value: 42 }]))
    const catalog = createCatalogExecutor({ loader, executor })

    const spec: QuerySpec<[], number> = {
      id: 'demo.scalar.single-col',
      sqlFile: 'scalar-simple.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: 42,
      },
    }

    await expect(catalog.scalar(spec, [])).resolves.toBe(42)
    expect(executor).toHaveBeenCalledWith('select value from demo', [])
  })

  it('scalar rejects mismatched shapes', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select value from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ value: 1 }]))
    const catalog = createCatalogExecutor({ loader, executor })

    const positionalSpec: QuerySpec<any, number> = {
      id: 'demo.scalar.positional-shape',
      sqlFile: 'scalar-shape.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: 1,
      },
    }

    const positionalAttempt = catalog.scalar(positionalSpec, { value: 1 } as any)
    await expect(positionalAttempt).rejects.toBeInstanceOf(ContractViolationError)
    await expect(positionalAttempt).rejects.toMatchObject({
      specId: positionalSpec.id,
    })

    const namedSpec: QuerySpec<any, number> = {
      id: 'demo.scalar.named-shape',
      sqlFile: 'scalar-shape.sql',
      params: { shape: 'named', example: { value: 1 } },
      output: {
        example: 1,
      },
    }

    const namedAttempt = catalog.scalar(namedSpec, [] as any)
    await expect(namedAttempt).rejects.toBeInstanceOf(ContractViolationError)
    await expect(namedAttempt).rejects.toMatchObject({
      specId: namedSpec.id,
    })
  })

  it('positional shape enforcement rejects record params', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select id from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ id: 1 }]))
    const catalog = createCatalogExecutor({ loader, executor })

    const spec: QuerySpec<any, { id: number }> = {
      id: 'demo.shape.positional',
      sqlFile: 'shape.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: { id: 1 },
      },
    }

    const attempt = catalog.list(spec, { id: 1 } as any)
    await expect(attempt).rejects.toBeInstanceOf(ContractViolationError)
    await expect(attempt).rejects.toMatchObject({ specId: spec.id })
  })

  it('named shape enforcement rejects array params', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select id from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ id: 1 }]))
    const catalog = createCatalogExecutor({ loader, executor })

    const spec: QuerySpec<any, { id: number }> = {
      id: 'demo.shape.named',
      sqlFile: 'shape.sql',
      params: { shape: 'named', example: { id: 1 } },
      output: {
        example: { id: 1 },
      },
    }

    const attempt = catalog.list(spec, [] as any)
    await expect(attempt).rejects.toBeInstanceOf(ContractViolationError)
    await expect(attempt).rejects.toMatchObject({
      specId: spec.id,
    })
  })

  it('named + no binder default reject', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select id from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ id: 1 }]))
    const catalog = createCatalogExecutor({ loader, executor })

    const spec: QuerySpec<{ id: number }, { id: number }> = {
      id: 'demo.named.no-binder',
      sqlFile: 'named.sql',
      params: { shape: 'named', example: { id: 1 } },
      output: {
        example: { id: 1 },
      },
    }

    const attempt = catalog.list(spec, { id: 1 })
    await expect(attempt).rejects.toBeInstanceOf(ContractViolationError)
    await expect(attempt).rejects.toMatchObject({
      specId: spec.id,
      message: expect.stringContaining(
        'declares named parameters without a binder'
      ),
    })
  })

  it('named + no binder allow=true passes record to executor', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select id from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ id: 1 }]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      allowNamedParamsWithoutBinder: true,
    })

    const spec: QuerySpec<{ id: number }, { id: number }> = {
      id: 'demo.named.allow',
      sqlFile: 'named.sql',
      params: { shape: 'named', example: { id: 1 } },
      output: {
        example: { id: 1 },
      },
    }

    await expect(catalog.list(spec, { id: 1 })).resolves.toEqual([{ id: 1 }])
    expect(executor).toHaveBeenCalledWith('select id from demo', { id: 1 })
  })

  it('lets rewriters inspect spec metadata', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select id from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ id: 1 }]))
    const spec: QuerySpec<[], { id: number }> = {
      id: 'demo.rewriter',
      sqlFile: 'meta.sql',
      params: { shape: 'positional', example: [] },
      zsg: { allow: ['demo'], optionsExample: { demo: true } },
      output: {
        example: { id: 1 },
      },
    }
    const rewriteSpy = vi.fn((input: Parameters<Rewriter['rewrite']>[0]) => {
      const { spec: receivedSpec, sql, params } = input
      expect(receivedSpec).toBe(spec)
      expect(receivedSpec.zsg?.allow).toEqual(['demo'])
      return { sql: `${sql} -- ok`, params }
    })
    const rewriter: Rewriter = {
      name: 'meta-check',
      rewrite: rewriteSpy,
    }

    const catalog = createCatalogExecutor({
      loader,
      executor,
      rewriters: [rewriter],
    })

    await catalog.list(spec, [])
    expect(rewriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        specId: spec.id,
        spec,
        sql: 'select id from demo',
        params: [],
        options: undefined,
      })
    )
  })

  it('fails when a binder returns non-array params', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select id from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ id: 1 }]))
    const binder: Binder = {
      name: 'invalid-binder',
      bind: () => ({ sql: 'select id', params: { id: 1 } as any }),
    }
    const catalog = createCatalogExecutor({
      loader,
      executor,
      binders: [binder],
    })

    const spec: QuerySpec<[], { id: number }> = {
      id: 'demo.binder.invalid',
      sqlFile: 'binder.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: { id: 1 },
      },
    }

    const attempt = catalog.list(spec, [])
    await expect(attempt).rejects.toBeInstanceOf(BinderError)
    await expect(attempt).rejects.toMatchObject({ specId: spec.id })
  })

  it('pipeline: rewriter -> binder -> executor', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select value from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ value: 1 }]))
    const rewriterSpy = vi.fn((input: Parameters<Rewriter['rewrite']>[0]) => {
      return { sql: `${input.sql} -- rewritten`, params: input.params }
    })
    const binderSpy = vi.fn((input: Parameters<Binder['bind']>[0]) => {
      return { sql: `${input.sql} -- bound`, params: [1] }
    })

    const catalog = createCatalogExecutor({
      loader,
      executor,
      rewriters: [{ name: 'order-rewriter', rewrite: rewriterSpy }],
      binders: [{ name: 'order-binder', bind: binderSpy }],
    })

    const spec: QuerySpec<[], { value: number }> = {
      id: 'demo.pipeline',
      sqlFile: 'order.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: { value: 1 },
      },
    }

    await catalog.list(spec, [])

    expect(executor).toHaveBeenCalledWith(
      'select value from demo -- rewritten -- bound',
      [1]
    )
    const [rewriterCall, binderCall] = [
      rewriterSpy.mock.invocationCallOrder[0],
      binderSpy.mock.invocationCallOrder[0],
    ]
    const executorCall = executor.mock.invocationCallOrder[0]
    expect(rewriterCall).toBeLessThan(binderCall)
    expect(binderCall).toBeLessThan(executorCall)
    expect(rewriterSpy).toHaveBeenCalledTimes(1)
    expect(binderSpy).toHaveBeenCalledTimes(1)
    expect(executor).toHaveBeenCalledTimes(1)
  })

  it('emits observability events for list executions', async () => {
    const events: ObservabilityEvent[] = []
    const sink: ObservabilitySink = {
      emit(event) {
        events.push(event)
      },
    }
    const loader = { load: vi.fn(() => Promise.resolve('select label from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ label: 'ok' }]))
    const catalog = createCatalogExecutor({
      loader,
      executor,
      observabilitySink: sink,
    })

    const spec: QuerySpec<[], { label: string }> = {
      id: 'demo.observable',
      sqlFile: 'observe.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: { label: 'ok' },
      },
    }

    await catalog.list(spec, [])

    expect(events.map((event) => event.kind)).toEqual(['query_start', 'query_end'])
    const [start, end] = events
    expect(start).toMatchObject({
      kind: 'query_start',
      specId: spec.id,
      sqlFile: spec.sqlFile,
      attempt: 1,
    })
    expect(end).toMatchObject({
      kind: 'query_end',
      specId: spec.id,
      rowCount: 1,
      attempt: 1,
    })
    expect(start.execId).toBe(end.execId)
    expect((start as QueryStartEvent).paramsShape).toBe('positional')
  })

  it('validates outputs after the executor completes', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select id from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ id: 1 }]))
    const validateSpy = vi.fn<(row: unknown) => { id: number }>((row) => {
      return row as { id: number }
    })
    const catalog = createCatalogExecutor({ loader, executor })

    const spec: QuerySpec<[], { id: number }> = {
      id: 'demo.validator.order',
      sqlFile: 'validate.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: { id: 1 },
        validate: validateSpy,
      },
    }

    await catalog.list(spec, [])

    expect(executor).toHaveBeenCalledTimes(1)
    expect(validateSpy).toHaveBeenCalledTimes(1)
    expect(validateSpy.mock.invocationCallOrder[0]).toBeGreaterThan(
      executor.mock.invocationCallOrder[0]
    )
  })

  it('named + binder converts to array', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select id from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ id: 1 }]))
    const binder: Binder = {
      name: 'named-converter',
      bind: ({ sql, params }) => {
        expect(Array.isArray(params)).toBe(false)
        const named = params as Record<string, unknown>
        expect(named).toMatchObject({ id: 1 })
        return {
          sql: `${sql} -- bound`,
          params: [Number(named.id ?? 0)],
        }
      },
    }

    const catalog = createCatalogExecutor({
      loader,
      executor,
      binders: [binder],
    })

    const spec: QuerySpec<{ id: number }, { id: number }> = {
      id: 'demo.named.binder',
      sqlFile: 'named.sql',
      params: { shape: 'named', example: { id: 1 } },
      output: {
        example: { id: 1 },
      },
    }

    await expect(catalog.list(spec, { id: 1 })).resolves.toEqual([{ id: 1 }])
    expect(executor).toHaveBeenCalledWith('select id from demo -- bound', [1])
  })

  it('scalar throws when more than one row is returned', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select value from demo')) }
    const executor = vi.fn(() => Promise.resolve([{ value: 1 }, { value: 2 }]))
    const catalog = createCatalogExecutor({ loader, executor })

    const spec: QuerySpec<[], number> = {
      id: 'demo.scalar.multiple-rows',
      sqlFile: 'scalar-rows.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: 1,
      },
    }

    const attempt = catalog.scalar(spec, [])
    await expect(attempt).rejects.toBeInstanceOf(ContractViolationError)
    await expect(attempt).rejects.toMatchObject({
      specId: spec.id,
    })
  })

  it('scalar rejects when no rows are returned', async () => {
    const loader = { load: vi.fn(() => Promise.resolve('select value from demo')) }
    const executor = vi.fn(() => Promise.resolve([]))
    const catalog = createCatalogExecutor({ loader, executor })

    const spec: QuerySpec<[], number> = {
      id: 'demo.scalar.no-rows',
      sqlFile: 'scalar-none.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: 0,
      },
    }

    const attempt = catalog.scalar(spec, [])
    await expect(attempt).rejects.toBeInstanceOf(ContractViolationError)
    await expect(attempt).rejects.toMatchObject({
      specId: spec.id,
    })
  })

  it('scalar throws when a row contains multiple columns', async () => {
    const loader = {
      load: vi.fn(() => Promise.resolve('select value, extra from demo')),
    }
    const executor = vi.fn(() => Promise.resolve([{ value: 1, extra: 2 }]))
    const catalog = createCatalogExecutor({ loader, executor })

    const spec: QuerySpec<[], number> = {
      id: 'demo.scalar.multiple-cols',
      sqlFile: 'scalar-cols.sql',
      params: { shape: 'positional', example: [] },
      output: {
        example: 1,
      },
    }

    const attempt = catalog.scalar(spec, [])
    await expect(attempt).rejects.toBeInstanceOf(ContractViolationError)
    await expect(attempt).rejects.toMatchObject({
      specId: spec.id,
    })
  })
})
