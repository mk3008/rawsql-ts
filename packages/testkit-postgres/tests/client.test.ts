import { describe, expect, it } from 'vitest';
import type { TableDefinitionModel } from 'rawsql-ts';
import { createPostgresTestkitClient, type QueryExecutor } from '../src';

const usersTableDefinition: TableDefinitionModel = {
  name: 'users',
  columns: [
    { name: 'id', typeName: 'int', required: true },
    { name: 'email', typeName: 'text', required: true },
  ],
};

const resultExecutor: QueryExecutor = async (_sql, _params) => [{ id: 1, email: 'alice@example.com' }];

describe('Postgres testkit client', () => {
  it('accepts generated fixture manifests without scanning ddl.directories', async () => {
    const executor: QueryExecutor = async (_sql, _params) => [{ id: 1, email: 'alice@example.com' }];
    const client = createPostgresTestkitClient({
      queryExecutor: executor,
      generated: {
        tableDefinitions: [usersTableDefinition],
        tableRows: [{ tableName: 'users', rows: [{ id: 1, email: 'alice@example.com' }] }],
      },
    });

    const response = await client.query('select id, email from users where id = $1', [1]);

    expect(response.rows).toEqual([{ id: 1, email: 'alice@example.com' }]);
    expect(response.rowCount).toBe(1);
  });

  it('executes rewritten SQL via the provided executor and reports fixtures', async () => {
    const executed: Array<{ sql: string; params: readonly unknown[] }> = [];
    const fixturesApplied: string[][] = [];
    const executor: QueryExecutor = async (sql, params) => {
      executed.push({ sql, params });
      return [{ id: 1, email: 'alice@example.com' }];
    };

    const client = createPostgresTestkitClient({
      queryExecutor: executor,
      tableDefinitions: [usersTableDefinition],
      tableRows: [{ tableName: 'users', rows: [{ id: 1, email: 'alice@example.com' }] }],
      onExecute: (_sql, _params, fixtures) => {
        fixturesApplied.push(fixtures ?? []);
      },
    });

    const response = await client.query('select id, email from users where id = $1', [1]);
    expect(response.rows).toEqual([{ id: 1, email: 'alice@example.com' }]);
    expect(executed).toHaveLength(1);
    expect(executed[0].params).toEqual([1]);
    expect(fixturesApplied).toEqual([['users']]);
  });

  it('accepts object-shaped executor results and preserves rowCount', async () => {
    const executor: QueryExecutor = async () => ({
      rows: [{ id: 1, email: 'alice@example.com' }],
      rowCount: 7,
    })

    const client = createPostgresTestkitClient({
      queryExecutor: executor,
      tableDefinitions: [usersTableDefinition],
      tableRows: [{ tableName: 'users', rows: [{ id: 1, email: 'alice@example.com' }] }],
    })

    const response = await client.query('select id, email from users')
    expect(response.rows).toEqual([{ id: 1, email: 'alice@example.com' }])
    expect(response.rowCount).toBe(7)
  })
  it('disposes the executor exactly once', async () => {
    let disposeCount = 0;
    const client = createPostgresTestkitClient({
      queryExecutor: resultExecutor,
      disposeExecutor: () => {
        disposeCount += 1;
      },
    });

    await client.close();
    await client.close();
    expect(disposeCount).toBe(1);
  });
});

