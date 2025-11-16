import { describe, expect, it } from 'vitest';
import { InsertQuery, SimpleSelectQuery } from 'rawsql-ts';
import {
  CudValidationError,
  TestkitCudOptions,
  TestkitDbAdapter,
} from '../../src/cud/TestkitDbAdapter';
import type { TableDef } from '../../src/cud/helpers';

describe('TestkitDbAdapter CUD pipeline', () => {
  const userTable: TableDef = {
    tableName: 'users',
    columns: [
      { name: 'id', dbType: 'INTEGER', nullable: false, hasDefault: true },
      { name: 'email', dbType: 'TEXT', nullable: false },
      { name: 'status', dbType: 'TEXT', nullable: true, hasDefault: true },
    ],
  };

  const strictTable: TableDef = {
    tableName: 'users',
    columns: [
      { name: 'id', dbType: 'INTEGER', nullable: false },
      { name: 'email', dbType: 'TEXT', nullable: false },
      { name: 'status', dbType: 'TEXT', nullable: true, hasDefault: true },
    ],
  };

  const createAdapter = (tableDef: TableDef = userTable) => new TestkitDbAdapter([tableDef]);

  it('rewrites VALUES-based INSERTs to INSERT...SELECT with CASTs', () => {
    const adapter = createAdapter();
    const insert = adapter.rewriteInsert("INSERT INTO users (id, email) VALUES (1, 'alice@example.com')") as InsertQuery;
    const select = insert.selectQuery as SimpleSelectQuery;

    expect(select).toBeInstanceOf(SimpleSelectQuery);
    expect(select.selectClause.items.every((item) => item.value.constructor.name === 'CastExpression')).toBe(true);
  });

  it('throws validation errors when required columns are omitted', () => {
    const adapter = createAdapter(strictTable);
    const invalidSql = "INSERT INTO users (email) VALUES ('missing-id@example.com')";
    expect(() => adapter.rewriteInsert(invalidSql)).toThrow(CudValidationError);
  });

  it('falls back instead of throwing when strict shape validation is disabled', () => {
    const adapter = createAdapter(strictTable);
    const invalidSql = "INSERT INTO users (email) VALUES ('still-missing-id@example.com')";
    const options: TestkitCudOptions = { failOnShapeIssues: false };
    expect(adapter.rewriteInsert(invalidSql, options)).toBeNull();
  });

  it('throws runtime DTO validation errors when the SELECT lacks a FROM clause', () => {
    const adapter = createAdapter();
    const dtoSql = 'INSERT INTO users (id, email) SELECT 1 AS id, \'dto@example.com\' AS email';
    const options: TestkitCudOptions = { enableRuntimeDtoValidation: true };
    expect(() => adapter.rewriteInsert(dtoSql, options)).toThrow(CudValidationError);
  });

  it('allows DTO selects with FROM when runtime validation is enabled', () => {
    const adapter = createAdapter();
    const dtoSql = 'INSERT INTO users (id, email) SELECT id, email FROM users';
    const options: TestkitCudOptions = { enableRuntimeDtoValidation: true };
    expect(() => adapter.rewriteInsert(dtoSql, options)).not.toThrow();
  });

  it('simulates RETURNING rows from DTO payloads', () => {
    const adapter = createAdapter();
    const insert = adapter.rewriteInsert(
      "INSERT INTO users (email, status) VALUES ('demo@example.com', 'active') RETURNING id, email, status",
    ) as InsertQuery;
    const rows = adapter.simulateReturningRows(insert);

    expect(rows).not.toBeNull();
    expect(rows?.length).toBe(1);
    expect(rows?.[0]).toMatchObject({
      id: 1,
      email: 'demo@example.com',
      status: 'active',
    });
  });

  it('increments auto-number defaults consistently per adapter', () => {
    const adapter = new TestkitDbAdapter([userTable]);
    const insert = adapter.rewriteInsert(
      "INSERT INTO users (email, status) VALUES ('first@example.com', 'ok') RETURNING id",
    ) as InsertQuery;
    const first = adapter.simulateReturningRows(insert);
    const second = adapter.simulateReturningRows(insert);

    expect(first?.[0]?.id).toBe(1);
    expect(second?.[0]?.id).toBe(2);
  });
});
