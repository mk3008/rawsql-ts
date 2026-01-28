import type { Row } from '@rawsql-ts/sql-contract/mapper'
import {
  DefaultFixtureProvider,
  ResultSelectRewriter,
  TableNameResolver,
} from '@rawsql-ts/testkit-core'
import type { TableDefinitionModel, TableRowsFixture } from '@rawsql-ts/testkit-core'

const customerTableDefinition: TableDefinitionModel = {
  name: 'public.customers',
  columns: [
    { name: 'customer_id', typeName: 'INTEGER' },
    { name: 'customer_name', typeName: 'TEXT' },
    { name: 'balance', typeName: 'NUMERIC' },
  ],
}

const tableNameResolver = new TableNameResolver({ defaultSchema: 'public' })
const fixtureProvider = new DefaultFixtureProvider(
  [customerTableDefinition],
  [],
  tableNameResolver
)
const rewriter = new ResultSelectRewriter(
  fixtureProvider,
  'error',
  undefined,
  tableNameResolver
)

/** Runs the testkit rewrite pipeline for the provided SQL/fixture pair. */
export function rewriteFixtureQuery(
  sql: string,
  rows: Row[],
  tableName = 'customers'
): void {
  const fixtures: TableRowsFixture[] = [
    {
      tableName,
      rows,
    },
  ]
  rewriter.rewrite(sql, fixtures)
}
