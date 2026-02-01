import { describe, expect, it } from 'vitest'
import {
  createMapper,
  rowMapping,
  type KeyValue,
  type Row,
  type RowMapping,
  __internal,
} from '@rawsql-ts/sql-contract/mapper'

type CompositeEntity = {
  entityId: number
  variant: string
  label: string
}

const compositeMapping = rowMapping<CompositeEntity>({
  name: 'CompositeEntity',
  key: ['entity_id', 'variant'],
  columnMap: {
    entityId: 'entity_id',
    variant: 'variant',
    label: 'label',
  },
})

type DerivedEntity = {
  rawValue: KeyValue
  label: string
}

const derivedMapping = rowMapping<DerivedEntity>({
  name: 'DerivedEntity',
  key: (row) => row.rawValue,
  columnMap: {
    rawValue: 'raw_value',
    label: 'label',
  },
  coerce: false,
})

const createReaderFromRows = <T>(mapping: RowMapping<T>, rows: Row[]) => {
  const mapper = createMapper(async () => rows)
  return mapper.bind(mapping)
}

describe('rowMapping composite keys', () => {
  it('keeps rows unique when every column combination matters', async () => {
    const reader = createReaderFromRows(compositeMapping, [
      { entity_id: 1, variant: 'alpha', label: 'first' },
      { entity_id: 1, variant: 'beta', label: 'second' },
    ])

    await expect(reader.list('select ...')).resolves.toEqual([
      { entityId: 1, variant: 'alpha', label: 'first' },
      { entityId: 1, variant: 'beta', label: 'second' },
    ])
  })

  it('throws when a composite key column is missing', async () => {
    const reader = createReaderFromRows(compositeMapping, [
      // Missing "variant" column so normalization should fail.
      { entity_id: 2, label: 'missing variant' },
    ])

    await expect(reader.list('select ...')).rejects.toThrow(
      /CompositeEntity: Missing key column "variant"/
    )
  })

  it('throws when a key column value is null', async () => {
    const reader = createReaderFromRows(compositeMapping, [
      { entity_id: null, variant: 'alpha', label: 'nullable' } as unknown as Row,
    ])

    await expect(reader.list('select ...')).rejects.toThrow(
      /CompositeEntity: Missing key value for column "entity_id"/
    )
  })

  it('throws when a key column value is undefined', async () => {
    const reader = createReaderFromRows(compositeMapping, [
      { entity_id: undefined, variant: 'alpha', label: 'undef' } as unknown as Row,
    ])

    await expect(reader.list('select ...')).rejects.toThrow(
      /CompositeEntity: Missing key value for column "entity_id"/
    )
  })

  it('distinguishes numeric and string key values', async () => {
    const reader = createReaderFromRows(derivedMapping, [
      { raw_value: '1', label: 'string one' },
      { raw_value: 1, label: 'number one' },
    ])

    await expect(reader.list('select ...')).resolves.toEqual([
      { rawValue: '1', label: 'string one' },
      { rawValue: 1, label: 'number one' },
    ])
  })

  it('does not collide when key parts contain separators', async () => {
    const reader = createReaderFromRows(compositeMapping, [
      { entity_id: 1, variant: 'a:b', label: 'x' },
      { entity_id: 1, variant: 'a', label: 'y' },
    ])

    await expect(reader.list('select ...')).resolves.toEqual([
      { entityId: 1, variant: 'a:b', label: 'x' },
      { entityId: 1, variant: 'a', label: 'y' },
    ])
  })

  it('treats composite key order as significant', () => {
    const row: Row = { entity_id: 1, variant: 'alpha', label: 'x' }

    const keyA = __internal.normalizeKeyFromRow(
      row,
      ['entity_id', 'variant'],
      'CompositeEntityA'
    )
    const keyB = __internal.normalizeKeyFromRow(
      row,
      ['variant', 'entity_id'],
      'CompositeEntityB'
    )

    expect(keyA).not.toEqual(keyB)
  })

  it('distinguishes numeric and string key values at normalization level', () => {
    const s = __internal.normalizeKeyValue('1')
    const n = __internal.normalizeKeyValue(1)

    expect(s).not.toEqual(n)
  })

  it('does not collide when key parts contain separators at normalization level', () => {
    const a = __internal.normalizeKeyValue(['a', 'b:c'])
    const b = __internal.normalizeKeyValue(['a:b', 'c'])

    expect(a).not.toEqual(b)
  })
})
