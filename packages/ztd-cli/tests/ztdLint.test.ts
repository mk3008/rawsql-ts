import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from 'pg';
import { describe, expect, test } from 'vitest';
import { runSqlLint } from '../src/commands/lint';

const createTempDir = (prefix: string): string =>
  mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));

const describeIfPg = process.env.TEST_PG_URI ? describe : describe.skip;

const VALID_JOIN_SQL = `
select
  u.user_id,
  o.order_id
from [users] u
inner join [orders] o
  on o.user_id = u.user_id
where u.user_id = 1;
`;

const MISSING_COLUMN_SQL = `
select missing_column
from [users]
where user_id = 1;
`;

const SYNTAX_ERROR_SQL = `select missing_function(1);`;
const TRANSFORM_MISSING_FIXTURE_SQL = `
select *
from [missing]
where 1 = 1;
`;

describeIfPg('runSqlLint integration', () => {
  test('valid join query passes through lint', async () => {
    const { ddlDir, sqlPath } = prepareWorkspaceWithSql(VALID_JOIN_SQL);
    const client = new Client({ connectionString: process.env.TEST_PG_URI });
    await client.connect();
    try {
      const result = await runSqlLint({
        sqlFiles: [sqlPath],
        ddlDirectories: [ddlDir],
        defaultSchema: 'public',
        searchPath: ['public'],
        ddlLint: 'strict',
        client
      });
      expect(result.failures).toHaveLength(0);
      expect(result.filesChecked).toBe(1);
    } finally {
      await client.end();
    }
  });

  test('postgres column error surfaces as db failure', async () => {
    const { ddlDir, sqlPath } = prepareWorkspaceWithSql(MISSING_COLUMN_SQL);
    const client = new Client({ connectionString: process.env.TEST_PG_URI });
    await client.connect();
    try {
      const result = await runSqlLint({
        sqlFiles: [sqlPath],
        ddlDirectories: [ddlDir],
        defaultSchema: 'public',
        searchPath: ['public'],
        ddlLint: 'strict',
        client
      });
      expect(result.failures.length).toBeGreaterThan(0);
      const failure = result.failures[0];
      expect(failure.kind).toBe('db');
      expect(failure.message.toLowerCase()).toContain('column');
      expect(failure.message.toLowerCase()).toContain('does not exist');
      expect(failure.details?.code).toBe('42703');
    } finally {
      await client.end();
    }
  });

  test('postgres syntax error surfaces as db failure', async () => {
    const { ddlDir, sqlPath } = prepareWorkspaceWithSql(SYNTAX_ERROR_SQL);      
    const client = new Client({ connectionString: process.env.TEST_PG_URI });   
    await client.connect();
    try {
      const result = await runSqlLint({
        sqlFiles: [sqlPath],
        ddlDirectories: [ddlDir],
        defaultSchema: 'public',
        searchPath: ['public'],
        ddlLint: 'strict',
        client
      });
      expect(result.failures.length).toBeGreaterThan(0);
      const failure = result.failures[0];
      expect(failure.kind).toBe('db');
      expect(failure.message.toLowerCase()).toContain('function');
      expect(failure.details?.code).toBe('42883');
    } finally {
      await client.end();
    }
  });

  test('ZTD transform errors surface fixture diagnostics', async () => {        
    const { ddlDir, sqlPath } = prepareWorkspaceWithSql(TRANSFORM_MISSING_FIXTURE_SQL);
    const client = new Client({ connectionString: process.env.TEST_PG_URI });   
    await client.connect();
    try {
      const result = await runSqlLint({
        sqlFiles: [sqlPath],
        ddlDirectories: [ddlDir],
        defaultSchema: 'public',
        searchPath: ['public'],
        ddlLint: 'strict',
        client
      });
      expect(result.failures.length).toBeGreaterThan(0);
      const failure = result.failures[0];
      expect(failure.kind).toBe('db');
      expect(failure.message.toLowerCase()).toContain('missing');
      expect(failure.details?.code).toBe('42P01');
    } finally {
      await client.end();
    }
  });
});

function prepareWorkspaceWithSql(
  sqlTemplate: string
): { ddlDir: string; sqlPath: string } {
  const workspace = createTempDir('ztd-lint-integration');
  const ddlDir = path.join(workspace, 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  const baseName = `lint_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const usersTable = `${baseName}_users`;
  const ordersTable = `${baseName}_orders`;

  writeFileSync(
    path.join(ddlDir, 'schema.sql'),
    `
    CREATE TABLE public.${usersTable} (
      user_id integer PRIMARY KEY,
      name text NOT NULL
    );

    CREATE TABLE public.${ordersTable} (
      order_id integer PRIMARY KEY,
      user_id integer NOT NULL
    );
    `,
    'utf8'
  );

  const sqlPath = path.join(workspace, 'query.sql');
  const missingTable = `${baseName}_missing`;
  const sql = sqlTemplate
    .replace(/\[users\]/g, usersTable)
    .replace(/\[orders\]/g, ordersTable)
    .replace(/\[missing\]/g, missingTable);
  writeFileSync(sqlPath, sql, 'utf8');
  return { ddlDir, sqlPath };
}
