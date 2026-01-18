import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { createPgTestkitClient, wrapPgClient } from '../src';
import type { PgQueryable } from '../src';
import { usersTableDefinition } from './fixtures/TableDefinitions';

const createNoopResult = (): QueryResult => ({
  command: 'NOOP',
  rowCount: 0,
  oid: 0,
  fields: [],
  rows: [],
});

const noopClient: PgQueryable = {
  query: async () => createNoopResult(),
};

describe('DDL diagnostics', () => {
  it('fails when a configured directory is missing', async () => {
    const missingDirectory = path.join('tmp', 'pg-testkit-missing-directory');
    await rm(missingDirectory, { recursive: true, force: true });

    expect(() =>
      createPgTestkitClient({
        connectionFactory: () => noopClient,
        ddl: { directories: [missingDirectory] },
      })
    ).toThrow(/DDL directories were not found/);
  });

  it('fails when a configured directory contains no SQL files', async () => {
    const emptyDirectory = path.join('tmp', 'pg-testkit-empty-ddl');
    await mkdir(emptyDirectory, { recursive: true });

    try {
      expect(() =>
        createPgTestkitClient({
          connectionFactory: () => noopClient,
          ddl: { directories: [emptyDirectory] },
        })
      ).toThrow(/No SQL files/);
    } finally {
      await rm(emptyDirectory, { recursive: true, force: true });
    }
  });
});

describe('fixture validation', () => {
  it('rejects tableRows that reference unknown columns', () => {
    expect(() =>
      createPgTestkitClient({
        connectionFactory: () => noopClient,
        tableDefinitions: [usersTableDefinition],
        tableRows: [{ tableName: 'users', rows: [{ id: 1, emali: 'typo' }] }],
      })
    ).toThrow(/Column 'emali' not found/);
  });

  it('rejects tableRows that reference tables missing from the definitions', () => {
    expect(() =>
      createPgTestkitClient({
        connectionFactory: () => noopClient,
        tableDefinitions: [usersTableDefinition],
        tableRows: [{ tableName: 'ghost_users', rows: [{ id: 1 }] }],
      })
    ).toThrow(/Table 'ghost_users' is not defined/);
  });

  it('validates scoped fixtures before wrapping a pg client', () => {
    const wrapped = wrapPgClient(noopClient, { tableDefinitions: [usersTableDefinition] });
    expect(() =>
      wrapped.withFixtures([{ tableName: 'users', rows: [{ id: 1, emali: 'typo' }] }])
    ).toThrow(/Column 'emali' not found/);
  });
});
