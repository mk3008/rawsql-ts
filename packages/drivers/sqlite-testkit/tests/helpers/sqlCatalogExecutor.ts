import Database from 'better-sqlite3';
import type { TableFixture } from '@rawsql-ts/testkit-core';
import { createSqliteSelectTestDriver } from '../../src/driver/SqliteSelectTestDriver';
import type { SqlCatalogExecutor } from '../utils/sqlCatalog';

/**
 * Create a fixture-backed SQLite executor for SQL catalog runner tests.
 */
export function createSqliteCatalogExecutor(): SqlCatalogExecutor {
  return async (
    sql: string,
    params: Record<string, unknown>,
    fixtures: TableFixture[],
    columnMap: Record<string, string>
  ): Promise<Record<string, unknown>[]> => {
    const driver = createSqliteSelectTestDriver({
      connectionFactory: () => new Database(':memory:'),
      fixtures,
    });
    try {
      const rows = await driver.query<Record<string, unknown>>(sql, [params]);
      return rows.map((row) => {
        const dto: Record<string, unknown> = {};
        // Keep DTO materialization deterministic by mapping only declared output columns.
        for (const [dtoKey, columnName] of Object.entries(columnMap)) {
          dto[dtoKey] = row[columnName];
        }
        return dto;
      });
    } finally {
      driver.close();
    }
  };
}
