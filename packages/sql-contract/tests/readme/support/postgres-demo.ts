import { afterAll } from 'vitest'
import { Client } from 'pg'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import {
  createReader,
  mapperPresets,
  toRowsExecutor,
  type Mapper,
  type QueryParams,
  type Row,
} from '@rawsql-ts/sql-contract/mapper'
import {
  DefaultFixtureProvider,
  ResultSelectRewriter,
  TableNameResolver,
} from '@rawsql-ts/testkit-core'
import type {
  TableDefinitionModel,
  TableRowsFixture,
} from '@rawsql-ts/testkit-core'

export interface ReadmePgTables {
  coreItems: string
  duckItems: string
  dtoItems: string
  validationItems: string
  customers: string
  orders: string
}

export interface ReadmePgContext {
  schemaName: string
  tables: ReadmePgTables
  mapper: Mapper
  query: (sql: string, params?: QueryParams) => Promise<Row[]>
  cleanup: () => Promise<void>
}

const readmeTables: ReadmePgTables = {
  coreItems: 'core_items',
  duckItems: 'duck_items',
  dtoItems: 'dto_items',
  validationItems: 'validation_items',
  customers: 'customers',
  orders: 'orders',
}

const schemaName = 'readme_demo'

const readmeTableDefinitions: TableDefinitionModel[] = [
  {
    name: `${schemaName}.core_items`,
    columns: [
      { name: 'id', typeName: 'INTEGER' },
      { name: 'label', typeName: 'TEXT' },
      { name: 'summary', typeName: 'TEXT' },
    ],
  },
  {
    name: `${schemaName}.duck_items`,
    columns: [
      { name: 'item_id', typeName: 'INTEGER' },
      { name: 'item_name', typeName: 'TEXT' },
      { name: 'created_at', typeName: 'TIMESTAMPTZ' },
    ],
  },
  {
    name: `${schemaName}.dto_items`,
    columns: [
      { name: 'dto_id', typeName: 'INTEGER' },
      { name: 'dto_label', typeName: 'TEXT' },
      { name: 'dto_value', typeName: 'DOUBLE PRECISION' },
    ],
  },
  {
    name: `${schemaName}.validation_items`,
    columns: [
      { name: 'id', typeName: 'INTEGER' },
      { name: 'label', typeName: 'TEXT' },
      { name: 'price', typeName: 'TEXT' },
    ],
  },
  {
    name: `${schemaName}.customers`,
    columns: [
      { name: 'id', typeName: 'INTEGER' },
      { name: 'name', typeName: 'TEXT' },
    ],
  },
  {
    name: `${schemaName}.orders`,
    columns: [
      { name: 'id', typeName: 'INTEGER' },
      { name: 'customer_id', typeName: 'INTEGER' },
      { name: 'total', typeName: 'DOUBLE PRECISION' },
    ],
  },
]

const readmeRowFixtures: TableRowsFixture[] = [
  {
    tableName: `${schemaName}.core_items`,
    rows: [
      { id: 1, label: 'alpha', summary: 'first entry' },
      { id: 2, label: 'beta', summary: 'second entry' },
    ],
  },
  {
    tableName: `${schemaName}.duck_items`,
    rows: [
      { item_id: 10, item_name: 'notebook', created_at: '2026-01-01T00:00:00Z' },
      { item_id: 11, item_name: 'pen', created_at: '2026-01-02T12:30:00Z' },
    ],
  },
  {
    tableName: `${schemaName}.dto_items`,
    rows: [
      { dto_id: 21, dto_label: 'primary', dto_value: 5.5 },
      { dto_id: 22, dto_label: 'secondary', dto_value: 9.75 },
    ],
  },
  {
    tableName: `${schemaName}.validation_items`,
    rows: [
      { id: 31, label: 'valid', price: '19.99' },
      { id: 32, label: 'invalid', price: 'not-a-number' },
    ],
  },
  {
    tableName: `${schemaName}.customers`,
    rows: [
      { id: 101, name: 'Maple' },
      { id: 102, name: 'Oak' },
    ],
  },
  {
    tableName: `${schemaName}.orders`,
    rows: [
      { id: 201, customer_id: 101, total: 59.95 },
      { id: 202, customer_id: 101, total: 24.5 },
      { id: 203, customer_id: 102, total: 8.25 },
    ],
  },
]

let cachedContext: Promise<ReadmePgContext> | undefined
let cleanupRegistered = false

export function getReadmePgContext(): Promise<ReadmePgContext> {
  if (!cachedContext) {
    cachedContext = buildContext()
  }
  if (!cleanupRegistered) {
    cleanupRegistered = true
    afterAll(async () => {
      if (!cachedContext) {
        return
      }
      const context = await cachedContext
      await context.cleanup()
      cachedContext = undefined
      cleanupRegistered = false
    })
  }
  return cachedContext
}

async function buildContext(): Promise<ReadmePgContext> {
  const container = await new PostgreSqlContainer('postgres:18-alpine').start()
  const client = new Client({
    connectionString: container.getConnectionUri(),
  })
  await client.connect()
  await client.query("SET TIME ZONE 'UTC'")

  const tableNameResolver = new TableNameResolver({
    defaultSchema: schemaName,
  })
  const fixtureProvider = new DefaultFixtureProvider(
    readmeTableDefinitions,
    readmeRowFixtures,
    tableNameResolver
  )
  const rewriter = new ResultSelectRewriter(
    fixtureProvider,
    'error',
    undefined,
    tableNameResolver
  )

  const executor = toRowsExecutor(async (sql, params) => {
    if (params !== undefined && !Array.isArray(params)) {
      throw new TypeError(
        `Readme fixture executor expected an array but got ${typeof params} (${describeParams(
          params
        )})`
      )
    }
    const rewritten = rewriter.rewrite(sql, readmeRowFixtures)
    const queryText = rewritten.sql || sql
    const result = await client.query(queryText, params ?? [])
    return result.rows as Row[]
  })

  const mapper = createReader(executor, mapperPresets.appLike())
  const cleanup = async () => {
    await client.end()
    await container.stop()
  }

  return {
    schemaName,
    tables: readmeTables,
    mapper,
    query: (sql: string, params?: QueryParams) => executor(sql, params ?? []),
    cleanup,
  }
}

function describeParams(params: QueryParams | undefined): string {
  if (params === undefined) {
    return 'undefined'
  }
  try {
    return JSON.stringify(params)
  } catch {
    return String(params)
  }
}
