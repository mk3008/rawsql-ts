import { describe, expect, it } from 'vitest';
import type { TableDefinitionModel } from 'rawsql-ts';
import { createPostgresTestkitClient, type PostgresTestkitClient, type QueryExecutor } from '../src';

const usersTableDefinition: TableDefinitionModel = {
  name: 'users',
  columns: [
    { name: 'id', typeName: 'int', required: true },
    { name: 'email', typeName: 'text', required: true },
  ],
};

const resultExecutor: QueryExecutor = async (_sql, _params) => [{ id: 1, email: 'alice@example.com' }];

async function runCrossDbWorkflow<RowA extends Record<string, unknown>, RowB extends Record<string, unknown>>(
  clients: {
    dbA: PostgresTestkitClient<RowA>;
    dbB: PostgresTestkitClient<RowB>;
  }
) {
  const aResult = await clients.dbA.query<{ id: number; email: string }>('select id, email from users where id = $1', [1]);
  const bResult = await clients.dbB.query<{ id: number; email: string }>('select id, email from users where id = $1', [2]);

  return { aResult, bResult };
}

describe('Postgres testkit client', () => {
  it('accepts generated fixture manifests without scanning ddl.directories', async () => {
    const executor: QueryExecutor = async (_sql, _params) => [{ id: 1, email: 'alice@example.com' }];
    const client = createPostgresTestkitClient({
      queryExecutor: executor,
      generated: {
        tableDefinitions: [usersTableDefinition],
      },
      ddl: {
        directories: ['__intentionally_missing_dir__'],
      },
      tableRows: [{ tableName: 'users', rows: [{ id: 1, email: 'alice@example.com' }] }],
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

  it('allows two database clients to participate in the same workflow without sharing lifecycle state', async () => {
    const dbAExecutions: Array<{ sql: string; params: readonly unknown[] }> = [];
    const dbBExecutions: Array<{ sql: string; params: readonly unknown[] }> = [];
    let dbACloseCount = 0;
    let dbBCloseCount = 0;

    const dbA = createPostgresTestkitClient({
      queryExecutor: async (sql, params) => {
        dbAExecutions.push({ sql, params });
        return [{ id: 1, email: 'db-a@example.com' }];
      },
      tableDefinitions: [usersTableDefinition],
      tableRows: [{ tableName: 'users', rows: [{ id: 1, email: 'db-a@example.com' }] }],
      disposeExecutor: () => {
        dbACloseCount += 1;
      },
    });

    const dbB = createPostgresTestkitClient({
      queryExecutor: async (sql, params) => {
        dbBExecutions.push({ sql, params });
        return [{ id: 2, email: 'db-b@example.com' }];
      },
      tableDefinitions: [usersTableDefinition],
      tableRows: [{ tableName: 'users', rows: [{ id: 2, email: 'db-b@example.com' }] }],
      disposeExecutor: () => {
        dbBCloseCount += 1;
      },
    });

    const workflowResult = await runCrossDbWorkflow({ dbA, dbB });

    expect(workflowResult.aResult.rows).toEqual([{ id: 1, email: 'db-a@example.com' }]);
    expect(workflowResult.bResult.rows).toEqual([{ id: 2, email: 'db-b@example.com' }]);
    expect(dbAExecutions).toHaveLength(1);
    expect(dbAExecutions[0]?.params).toEqual([1]);
    expect(dbAExecutions[0]?.sql).toContain('db-a@example.com');
    expect(dbBExecutions).toHaveLength(1);
    expect(dbBExecutions[0]?.params).toEqual([2]);
    expect(dbBExecutions[0]?.sql).toContain('db-b@example.com');

    await dbA.close();
    await dbB.close();
    expect(dbACloseCount).toBe(1);
    expect(dbBCloseCount).toBe(1);
  });
});

