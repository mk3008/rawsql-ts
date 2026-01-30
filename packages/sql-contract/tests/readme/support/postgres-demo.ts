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
  await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
  await client.query(`CREATE SCHEMA ${schemaName}`)
  await setupTables(client)
  await seedTables(client)

  const executor = toRowsExecutor(async (sql, params) => {
    const values = Array.isArray(params) ? params : []
    const result = await client.query(sql, values)
    return result.rows as Row[]
  })

  const mapper = createReader(executor, mapperPresets.appLike())
  const cleanup = async () => {
    await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
    await client.end()
    await container.stop()
  }

  return {
    schemaName,
    tables: readmeTables,
    mapper,
    query: (sql: string, params?: QueryParams) =>
      executor(sql, params ?? []),
    cleanup,
  }
}

async function setupTables(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE ${schemaName}.core_items (
      id INT PRIMARY KEY,
      label TEXT NOT NULL,
      summary TEXT NOT NULL
    );

    CREATE TABLE ${schemaName}.duck_items (
      item_id INT PRIMARY KEY,
      item_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE ${schemaName}.dto_items (
      dto_id INT PRIMARY KEY,
      dto_label TEXT NOT NULL,
      dto_value DOUBLE PRECISION NOT NULL
    );

    CREATE TABLE ${schemaName}.validation_items (
      id INT PRIMARY KEY,
      label TEXT NOT NULL,
      price TEXT NOT NULL
    );

    CREATE TABLE ${schemaName}.customers (
      id INT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE ${schemaName}.orders (
      id INT PRIMARY KEY,
      customer_id INT NOT NULL REFERENCES ${schemaName}.customers(id),
      total DOUBLE PRECISION NOT NULL
    );
  `)
}

async function seedTables(client: Client): Promise<void> {
  await client.query(`
    INSERT INTO ${schemaName}.core_items (id, label, summary) VALUES
      (1, 'alpha', 'first entry'),
      (2, 'beta', 'second entry');

    INSERT INTO ${schemaName}.duck_items (item_id, item_name, created_at) VALUES
      (10, 'notebook', '2026-01-01T00:00:00Z'),
      (11, 'pen', '2026-01-02T12:30:00Z');

    INSERT INTO ${schemaName}.dto_items (dto_id, dto_label, dto_value) VALUES
      (21, 'primary', 5.5),
      (22, 'secondary', 9.75);

    INSERT INTO ${schemaName}.validation_items (id, label, price) VALUES
      (31, 'valid', '19.99'),
      (32, 'invalid', 'not-a-number');

    INSERT INTO ${schemaName}.customers (id, name) VALUES
      (101, 'Maple'),
      (102, 'Oak');

    INSERT INTO ${schemaName}.orders (id, customer_id, total) VALUES
      (201, 101, 59.95),
      (202, 101, 24.5),
      (203, 102, 8.25);
  `)
}
