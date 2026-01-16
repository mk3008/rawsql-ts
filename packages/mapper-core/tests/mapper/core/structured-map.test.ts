import { describe, expect, it } from 'vitest'
import { columnMapFromPrefix, createMapper, entity, mapRows } from '../../../src'

type Customer = {
  id: number
  name: string
}

type Order = {
  id: number
  number: string
  customerId?: number
  customer?: Customer
}

type Product = {
  id: number
  sku: string
}

type Item = {
  id: number
  name: string
  orderId?: number
  productId?: number | null
  customerId?: number
  order?: Order
  product?: Product
  customer?: Customer
}

type Country = {
  id: number
  name: string
}

type CoerceTarget = {
  id: number
  amount: number
  active: boolean
  snapshot: Date
}

type RawNumberTarget = {
  id: number
  value: number
}

type NonIsoSnapshotTarget = {
  id: number
  snapshot: string
}

type RecursiveEntity = {
  id: number
  parentId?: number
  parent?: RecursiveEntity
}

interface CycleB {
  id: number
  aId?: number
  a?: CycleA
}

interface CycleA {
  id: number
  bId?: number
  b?: CycleB
}

describe('mapper structured mapping', () => {
  it('maps columnMap aliases with natural names', () => {
    const mapping = entity<Country>({
      name: 'Country',
      key: 'id',
      columnMap: {
        id: 'country_id',
        name: 'country_name',
      },
    })

    const [country] = mapRows(
      [
        {
          country_id: 55,
          country_name: 'Spain',
        },
      ],
      mapping
    )

    expect(country.id).toBe(55)
    expect(country.name).toBe('Spain')
  })

  it('supports belongsToWithLocalKey when child column is aliased via columnMap', () => {
    const customerMapping = entity<Customer>({
      name: 'Customer',
      key: 'id',
      columnMap: {
        id: 'customer_id',
        name: 'customer_name',
      },
    })

    const itemMapping = entity<Item>({
      name: 'Item',
      key: 'id',
      columnMap: {
        id: 'item_id',
        name: 'item_name',
        customerId: 'item_customer_id',
      },
    }).belongsToWithLocalKey('customer', customerMapping, 'customerId')

    const rows = [
      {
        item_id: 70,
        item_name: 'AliasDesk',
        customer_id: 8,
        customer_name: 'AliasCo',
        order_id: 300,
        order_number: 'ORD-300',
        order_customer_id: 8,
        item_customer_id: 8,
      },
    ]

    const [result] = mapRows(rows, itemMapping)
    expect(result.customer).toBeDefined()
    expect(result.customer?.name).toBe('AliasCo')
  })

  it('builds columnMap entries from an explicit prefix helper', () => {
    const mapping = entity<Country>({
      name: 'Country',
      key: 'id',
      columnMap: columnMapFromPrefix('country_', ['id', 'name'] as const),
    })

    const [country] = mapRows(
      [
        {
          country_id: 88,
          country_name: 'Japan',
        },
      ],
      mapping
    )

    expect(country.id).toBe(88)
    expect(country.name).toBe('Japan')
  })

  describe('belongsTo configuration', () => {
    it('captures the explicit local key on the parent relation', () => {
      const customerMapping = entity<Customer>({
        name: 'Customer',
        key: 'id',
        columnMap: {
          id: 'customer_id',
          name: 'customer_name',
        },
      })

      const inferredMapping = entity<Item>({
        name: 'Item',
        key: 'id',
        columnMap: {
          id: 'item_id',
          name: 'item_name',
          customerId: 'customer_id',
        },
      }).belongsToWithLocalKey('customer', customerMapping, 'customerId')

      expect(inferredMapping.parents[0].localKey).toBe('customerId')

      const explicitMapping = entity<Item>({
        name: 'ItemDto',
        key: 'id',
        columnMap: {
          id: 'item_id',
          name: 'item_name',
          customerId: 'customer_id',
        },
      }).belongsToWithLocalKey('customer', customerMapping, 'customerId')

      expect(explicitMapping.parents[0].localKey).toBe('customerId')
    })
  })

  it('hydrates parents and reuses nested parents for repeated join keys', () => {
    const customerMapping = entity<Customer>({
      name: 'Customer',
      key: 'id',
      columnMap: {
        id: 'customer_id',
        name: 'customer_name',
      },
    })

    const orderMapping = entity<Order>({
      name: 'Order',
      key: 'id',
      columnMap: {
        id: 'order_id',
        number: 'order_number',
        customerId: 'order_customer_id',
      },
    }).belongsToWithLocalKey('customer', customerMapping, 'customerId')

    const itemMapping = entity<Item>({
      name: 'Item',
      key: 'id',
      columnMap: {
        id: 'item_id',
        name: 'item_name',
        orderId: 'item_order_id',
      },
    }).belongsToWithLocalKey('order', orderMapping, 'orderId')

    const rows = [
      {
        item_id: 1,
        item_name: 'Desk',
        item_order_id: 100,
        order_id: 100,
        order_number: 'ORD-100',
        order_customer_id: 5,
        customer_id: 5,
        customer_name: 'Acme Supplies',
      },
      {
        item_id: 2,
        item_name: 'Chair',
        item_order_id: 100,
        order_id: 100,
        order_number: 'ORD-100',
        order_customer_id: 5,
        customer_id: 5,
        customer_name: 'Acme Supplies',
      },
    ]

    const [first, second] = mapRows(rows, itemMapping)

    expect(first.order).toBe(second.order)
    expect(first.order?.customer).toBe(second.order?.customer)
    expect(first.order?.customer?.name).toBe('Acme Supplies')
    expect(first.name).toBe('Desk')
    expect(second.name).toBe('Chair')
  })

  describe('optional parents', () => {
    it('ignores parent columns when local key is null', () => {
      const productMapping = entity<Product>({
        name: 'Product',
        key: 'id',
        columnMap: {
          id: 'product_id',
          sku: 'product_sku',
        },
      })

      const itemMapping = entity<Item>({
        name: 'Item',
        key: 'id',
        columnMap: {
          id: 'item_id',
          name: 'item_name',
          productId: 'item_product_id',
        },
      }).belongsToOptional('product', productMapping, 'productId')

      const rows = [
        {
          item_id: 3,
          item_name: 'Shelf',
          item_product_id: null,
          product_id: 200,
          product_sku: 'B1',
        },
      ]

      const [result] = mapRows(rows, itemMapping)
      expect(result.product).toBeUndefined()
    })

    it('does not hydrate parent when parent key columns are null even if local key exists', () => {
      const productMapping = entity<Product>({
        name: 'Product',
        key: 'id',
        columnMap: {
          id: 'product_id',
          sku: 'product_sku',
        },
      })

      const itemMapping = entity<Item>({
        name: 'Item',
        key: 'id',
        columnMap: {
          id: 'item_id',
          name: 'item_name',
          productId: 'item_product_id',
        },
      }).belongsToOptional('product', productMapping, 'productId')

      const rows = [
        {
          item_id: 4,
          item_name: 'Lamp',
          item_product_id: 99,
          product_id: null,
          product_sku: null,
        },
      ]

      const [result] = mapRows(rows, itemMapping)
      expect(result.product).toBeUndefined()
    })

    it('hydrates optional parent when local key value is zero', () => {
      const productMapping = entity<Product>({
        name: 'Product',
        key: 'id',
        columnMap: {
          id: 'product_id',
          sku: 'product_sku',
        },
      })

      const itemMapping = entity<Item>({
        name: 'Item',
        key: 'id',
        columnMap: {
          id: 'item_id',
          name: 'item_name',
          productId: 'item_product_id',
        },
      }).belongsToOptional('product', productMapping, 'productId')

      const rows = [
        {
          item_id: 50,
          item_name: 'ZeroStock',
          item_product_id: 0,
          product_id: 0,
          product_sku: 'Zero',
        },
      ]

      const [result] = mapRows(rows, itemMapping)
      expect(result.product).toBeDefined()
      expect(result.product?.id).toBe(0)
      expect(result.product?.sku).toBe('Zero')
    })

    it('throws when optional parent local key column is absent', () => {
      const productMapping = entity<Product>({
        name: 'Product',
        key: 'id',
        columnMap: {
          id: 'product_id',
          sku: 'product_sku',
        },
      })

      const itemMapping = entity<Item>({
        name: 'Item',
        key: 'id',
        columnMap: {
          id: 'item_id',
          name: 'item_name',
        },
      }).belongsToOptional('product', productMapping, 'productId')

      const rows = [
        {
          item_id: 9,
          item_name: 'NoLocalKey',
          product_id: 200,
          product_sku: 'B2',
        },
      ]

      expect(() => mapRows(rows, itemMapping)).toThrow(/Missing local key column/)
    })
  })

  describe('relation cycles', () => {
    it('throws when an entity references itself recursively', () => {
      const recursiveMapping = entity<RecursiveEntity>({
        name: 'Recursive',
        key: 'id',
        columnMap: {
          id: 'rec_id',
          parentId: 'rec_parent_id',
        },
      })

      recursiveMapping.belongsToWithLocalKey(
        'parent',
        recursiveMapping,
        'parentId'
      )

      const rows = [
        {
          rec_id: 1,
          rec_parent_id: 1,
        },
      ]

    expect(() => mapRows(rows, recursiveMapping)).toThrow(
      /Circular entity mapping detected: Recursive\(1\) -> Recursive\.parent\(1\)/
    )
    })

    it('throws when mutual relations form a cycle', () => {
      const aMapping = entity<CycleA>({
        name: 'CycleA',
        key: 'id',
        columnMap: {
          id: 'a_id',
          bId: 'a_b_id',
        },
      })
      const bMapping = entity<CycleB>({
        name: 'CycleB',
        key: 'id',
        columnMap: {
          id: 'b_id',
          aId: 'b_a_id',
        },
      })

      aMapping.belongsToWithLocalKey('b', bMapping, 'bId')
      bMapping.belongsToWithLocalKey('a', aMapping, 'aId')

      const rows = [
        {
          a_id: 1,
          a_b_id: 2,
          b_id: 2,
          b_a_id: 1,
        },
      ]

      expect(() => mapRows(rows, aMapping)).toThrow(
        /Circular entity mapping detected: CycleA\(1\) -> CycleB\.b\(2\) -> CycleA\.a\(1\)/
      )
    })
  })

  it('hydrates multiple parents on the same row without cross contamination', () => {
    const orderMapping = entity<Order>({
      name: 'Order',
      key: 'id',
      columnMap: {
        id: 'order_id',
        number: 'order_number',
      },
    })

    const productMapping = entity<Product>({
      name: 'Product',
      key: 'id',
      columnMap: {
        id: 'product_id',
        sku: 'product_sku',
      },
    })

    const itemMapping = entity<Item>({
      name: 'Item',
      key: 'id',
      columnMap: {
        id: 'item_id',
        name: 'item_name',
        orderId: 'item_order_id',
        productId: 'item_product_id',
      },
    })
      .belongsToWithLocalKey('order', orderMapping, 'orderId')
      .belongsToOptional('product', productMapping, 'productId')

    const rows = [
      {
        item_id: 5,
        item_name: 'Desk',
        item_order_id: 101,
        order_id: 101,
        order_number: 'ORD-101',
        item_product_id: 300,
        product_id: 300,
        product_sku: 'Z3',
      },
      {
        item_id: 6,
        item_name: 'Stool',
        item_order_id: 101,
        order_id: 101,
        order_number: 'ORD-101',
        item_product_id: null,
        product_id: null,
        product_sku: null,
      },
    ]

    const [desk, stool] = mapRows(rows, itemMapping)

    expect(desk.order).toBeDefined()
    expect(desk.product).toMatchObject({ id: 300, sku: 'Z3' })
    expect(stool.order).toBeDefined()
    expect(stool.product).toBeUndefined()
  })

  describe('missing columns', () => {
    it('throws when a required local key column is present but null', () => {
      const customerMapping = entity<Customer>({
        name: 'Customer',
        key: 'id',
        columnMap: {
          id: 'customer_id',
          name: 'customer_name',
        },
      })

      const itemMapping = entity<Item>({
        name: 'Item',
        key: 'id',
        columnMap: {
          id: 'item_id',
          name: 'item_name',
          customerId: 'item_customer_id',
        },
      }).belongsToWithLocalKey('customer', customerMapping, 'customerId')

      const rows = [
        {
          item_id: 10,
          item_name: 'NullLocalKey',
          item_customer_id: null,
          customer_id: 5,
          customer_name: 'Ignored',
        },
      ]

      expect(() => mapRows(rows, itemMapping)).toThrow(
        /Local key column "item_customer_id" is null for relation "customer" on Item/
      )
    })

    it('throws when the root key column is absent', () => {
      const mapping = entity<{ id: number; label: string }>({
        name: 'RootEntity',
        key: 'id',
        columnMap: {
          id: 'root_id',
          label: 'root_label',
        },
      })

      expect(() => mapRows([{ root_label: 'no-key' }], mapping)).toThrow(
        /Missing key column/
      )
    })

    it('throws when a required parent local key column is absent', () => {
      const parent = entity<Order>({
        name: 'Order',
        key: 'id',
        columnMap: {
          id: 'order_id',
          number: 'order_number',
        },
      })
      const child = entity<Item>({
        name: 'Item',
        key: 'id',
        columnMap: {
          id: 'item_id',
          name: 'item_name',
        },
      }).belongsToWithLocalKey('order', parent, 'orderId')

      expect(() => mapRows([{ item_id: 10, item_name: 'Gap' }], child)).toThrow(
        /Missing local key column/
      )
    })

    it('throws when a required parent key column produced by the join is absent', () => {
      const parent = entity<Order>({
        name: 'Order',
        key: 'id',
        columnMap: {
          id: 'order_id',
          number: 'order_number',
        },
      })
      const child = entity<Item>({
        name: 'Item',
        key: 'id',
        columnMap: {
          id: 'item_id',
          name: 'item_name',
          orderId: 'item_order_id',
        },
      }).belongsToWithLocalKey('order', parent, 'orderId')

      const rows = [
        {
          item_id: 11,
          item_name: 'MissingParentKey',
          item_order_id: 999,
        },
      ]

      expect(() => mapRows(rows, child)).toThrow(/Missing key column.*order/i)
    })
  })

  describe('coercion controls', () => {
    it('coerces numeric, boolean, and ISO date strings by default', () => {
      const coercionMapping = entity<CoerceTarget>({
        name: 'Coercion',
        key: 'id',
        columnMap: {
          id: 'id',
          amount: 'amount',
          active: 'active',
          snapshot: 'snapshot',
        },
      })

      const [record] = mapRows(
        [
          {
            id: 1,
            amount: '100',
            active: 'true',
            snapshot: '2025-01-01T00:00:00Z',
          },
        ],
        coercionMapping
      )

      expect(record.amount).toBe(100)
      expect(record.active).toBe(true)
      expect(record.snapshot).toBeInstanceOf(Date)
      expect(record.snapshot.toISOString()).toBe('2025-01-01T00:00:00.000Z')
    })

    it('does not attempt Date coercion for arbitrary strings (even when they contain "+")', () => {
      const safeMapping = entity<NonIsoSnapshotTarget>({
        name: 'IsoSafety',
        key: 'id',
        columnMap: {
          id: 'id',
          snapshot: 'snapshot',
        },
      })

      const [record] = mapRows(
        [
          {
            id: 4,
            snapshot: 'C++',
          },
        ],
        safeMapping
      )

      expect(record.snapshot).toBe('C++')
    })

    it('skips Date coercion for non-ISO yet parseable strings', () => {
      const safeMapping = entity<NonIsoSnapshotTarget>({
        name: 'IsoSafety',
        key: 'id',
        columnMap: {
          id: 'id',
          snapshot: 'snapshot',
        },
      })

      const rows = [
        {
          id: 5,
          snapshot: '2025/01/01 00:00:00',
        },
        {
          id: 6,
          snapshot: 'Jan 1, 2025',
        },
      ]

      const [first, second] = mapRows(rows, safeMapping)

      expect(first.snapshot).toBe('2025/01/01 00:00:00')
      expect(second.snapshot).toBe('Jan 1, 2025')
    })

    it('leaves values untouched when coercion is disabled', () => {
      const rawMapping = entity<RawNumberTarget>({
        name: 'Raw',
        key: 'id',
        columnMap: {
          id: 'id',
          value: 'value',
        },
        coerce: false,
      })

      const [record] = mapRows(
        [
          {
            id: 2,
            value: '200',
          },
        ],
        rawMapping
      )

      const rawValue = record.value as unknown as string
      expect(typeof rawValue).toBe('string')
      expect(rawValue).toBe('200')
    })
  })

  it('limits cache reuse to the current query invocation', () => {
    const orderMapping = entity<Order>({
      name: 'Order',
      key: 'id',
      columnMap: {
        id: 'order_id',
        number: 'order_number',
      },
    })

    const itemMapping = entity<Item>({
      name: 'Item',
      key: 'id',
      columnMap: {
        id: 'item_id',
        name: 'item_name',
        orderId: 'item_order_id',
      },
    }).belongsToWithLocalKey('order', orderMapping, 'orderId')

    const rows = [
      {
        item_id: 12,
        item_name: 'CacheA',
        item_order_id: 201,
        order_id: 201,
        order_number: 'ORD-201',
      },
      {
        item_id: 13,
        item_name: 'CacheB',
        item_order_id: 201,
        order_id: 201,
        order_number: 'ORD-201',
      },
    ]

    const [first, second] = mapRows(rows, itemMapping)
    expect(first.order).toBe(second.order)

    const [third] = mapRows(rows, itemMapping)
    expect(third.order).not.toBe(first.order)
  })

  it('mapper.query cache is scoped to each execution', async () => {
    const orderMapping = entity<Order>({
      name: 'Order',
      key: 'id',
      columnMap: {
        id: 'order_id',
        number: 'order_number',
      },
    })

    const itemMapping = entity<Item>({
      name: 'Item',
      key: 'id',
      columnMap: {
        id: 'item_id',
        name: 'item_name',
        orderId: 'item_order_id',
      },
    }).belongsToWithLocalKey('order', orderMapping, 'orderId')

    const rows = [
      {
        item_id: 14,
        item_name: 'QueryOne',
        item_order_id: 301,
        order_id: 301,
        order_number: 'ORD-301',
      },
    ]

    const mapper = createMapper(async () => rows)
    const [first] = await mapper.query('SELECT ...', [], itemMapping)
    const [second] = await mapper.query('SELECT ...', [], itemMapping)

    expect(first.order).toBeDefined()
    expect(second.order).toBeDefined()
    expect(first.order).not.toBe(second.order)
  })
})
