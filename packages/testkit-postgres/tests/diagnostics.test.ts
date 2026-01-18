import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { TableDefinitionModel } from 'rawsql-ts';
import { createPostgresTestkitClient, type QueryExecutor } from '../src';

const noopExecutor: QueryExecutor = async (_sql, _params) => [];

const usersTableDefinition: TableDefinitionModel = {
  name: 'users',
  columns: [
    { name: 'id', typeName: 'int', required: true },
    { name: 'email', typeName: 'text', required: true },
    { name: 'active', typeName: 'bool', required: false },
  ],
};

describe('Postgres testkit diagnostics', () => {
  it('throws when a configured DDL directory is missing', async () => {
    const missingDirectory = path.join('tmp', 'testkit-postgres-missing');
    await rm(missingDirectory, { recursive: true, force: true });

    expect(() =>
      createPostgresTestkitClient({
        queryExecutor: noopExecutor,
        ddl: { directories: [missingDirectory] },
      })
    ).toThrow(/DDL directories were not found/);
  });

  it('throws when a configured DDL directory contains no SQL files', async () => {
    const emptyDirectory = path.join('tmp', 'testkit-postgres-empty');
    await mkdir(emptyDirectory, { recursive: true });
    try {
      expect(() =>
        createPostgresTestkitClient({
          queryExecutor: noopExecutor,
          ddl: { directories: [emptyDirectory] },
        })
      ).toThrow(/No SQL files/);
    } finally {
      await rm(emptyDirectory, { recursive: true, force: true });
    }
  });
});

describe('fixture validation', () => {
  it('rejects tableRows with unknown columns', () => {
    expect(() =>
      createPostgresTestkitClient({
        queryExecutor: noopExecutor,
        tableDefinitions: [usersTableDefinition],
        tableRows: [{ tableName: 'users', rows: [{ id: 1, emali: 'typo' }] }],
      })
    ).toThrow(/Column 'emali' not found/);
  });

  it('validates scoped fixtures when wrapping with fixtures', () => {
    const client = createPostgresTestkitClient({
      queryExecutor: noopExecutor,
      tableDefinitions: [usersTableDefinition],
    });

    expect(() =>
      client.withFixtures([{ tableName: 'users', rows: [{ id: 1, emali: 'typo' }] }])
    ).toThrow(/Column 'emali' not found/);
  });
});
