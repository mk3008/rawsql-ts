import { describe, expect, it, vi } from 'vitest';
import { MissingFixtureError, QueryRewriteError } from '../src/errors';
import { SelectFixtureRewriter } from '../src/rewriter/SelectFixtureRewriter';
import type { SchemaRegistry, TableSchemaDefinition } from '../src/types';

const schema: Record<string, TableSchemaDefinition> = {
  users: {
    columns: {
      id: 'INTEGER',
      name: 'TEXT',
      role: 'TEXT',
    },
  },
  orders: {
    columns: {
      id: 'INTEGER',
      total: 'REAL',
    },
  },
};
const registry: SchemaRegistry = {
  getTable: (name) => schema[name],
};

describe('SelectFixtureRewriter', () => {
  it('injects fixture CTE definitions for referenced tables', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [
            { id: 1, name: 'Alice', role: 'admin' },
            { id: 2, name: 'Bob', role: 'user' },
          ],
          schema: schema.users,
        },
      ],
    });
    const result = rewriter.rewrite("SELECT id, name FROM users WHERE role = 'admin'");
    expect(result.sql.toLowerCase().startsWith('with ')).toBe(true);
    expect(result.sql.toLowerCase()).toContain('"users" as');
    expect(result.sql).toContain(`select "id", "name" from "users" where "role" = 'admin'`);
    expect(result.fixturesApplied).toEqual(['users']);

    // full expected SQL for snapshot
    expect(result.sql, "with \"users\" as (select cast(1 as INTEGER) as \"id\", cast('Alice' as TEXT) as \"name\", cast('admin' as TEXT) as \"role\" union all select cast(2 as INTEGER) as \"id\", cast('Bob' as TEXT) as \"name\", cast('user' as TEXT) as \"role\") select \"id\", \"name\" from \"users\" where \"role\" = 'admin'");
  });

  it('injects fixture CTE using per-fixture schema before user-defined WITH CTE', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Temp', role: 'admin' }],
          // Use schema information defined on the fixture itself
          schema: schema.users,
        },
      ],
    });

    const sql = `WITH source AS (SELECT * FROM users) SELECT * FROM source`;
    const rewritten = rewriter.rewrite(sql);

    // `users` CTE is injected and appears before user-defined `source` CTE
    expect(rewritten.sql).toMatch(/with\s+"users"\s+as/i);
    expect(rewritten.sql.indexOf('"users"')).toBeLessThan(
      rewritten.sql.indexOf('"source"'),
    );

    // Full SQL: fixture CTE + original user-defined CTE
    expect(rewritten.sql).toBe(
      'with "users" as (select cast(1 as INTEGER) as "id", cast(\'Temp\' as TEXT) as "name", cast(\'admin\' as TEXT) as "role"), "source" as (select * from "users") select * from "source"'
    );
  });

  it('injects fixture CTE using registry-level schema and preserves user-defined WITH CTE', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Temp', role: 'admin' }],
        },
      ],
      // Use shared schema registry instead of per-fixture schema
      schema: registry,
    });

    const sql = `WITH source AS (SELECT * FROM users) SELECT * FROM source`;
    const rewritten = rewriter.rewrite(sql);

    // Same rewritten SQL should be produced as when using per-fixture schema
    expect(rewritten.sql).toBe(
      'with "users" as (select cast(1 as INTEGER) as "id", cast(\'Temp\' as TEXT) as "name", cast(\'admin\' as TEXT) as "role"), "source" as (select * from "users") select * from "source"'
    );
  });


  it('throws when fixtures are missing under the default strategy', () => {
    const rewriter = new SelectFixtureRewriter({
      schema: registry,
    });

    expect(() => rewriter.rewrite('SELECT * FROM users')).toThrowError(`Fixture for table "users" was not provided.

Diagnostics:
  - Strategy: error
  - Table: users
  - SQL snippet: SELECT * FROM users
  - Required columns (schema registry):
      • id (INTEGER)
      • name (TEXT)
      • role (TEXT)
  - Suggested fixture template:
      {
        tableName: 'users',
        schema: {
          columns: {
            id: 'INTEGER',
            name: 'TEXT',
            role: 'TEXT'
          }
        },
        rows: [
          { id: /* INTEGER */, name: /* TEXT */, role: /* TEXT */ }
        ],
      }

Next steps:
  1. Declare a fixture for the table with the columns listed above.
  2. Provide at least one row so rewritten SELECT statements shadow the physical table.
  3. Pass fixtures via SelectRewriterOptions.fixtures or rewrite context overrides.`);
  });

  it('describes missing fixtures with schema-derived column details', () => {
    const rewriter = new SelectFixtureRewriter({
      schema: registry,
    });
    
    try {
      rewriter.rewrite('SELECT id, name FROM users');
      throw new Error('Expected MissingFixtureError');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingFixtureError);
      const message = (error as MissingFixtureError).message;
      expect(message).toContain('Required columns');
      expect(message).toContain('id (INTEGER)');
      expect(message).toContain('name (TEXT)');
      expect(message).toContain('Suggested fixture template');
    }
  });

  it('warns instead of throwing when strategy is warn', () => {
    const warn = vi.fn();
    const rewriter = new SelectFixtureRewriter({
      schema: registry,
      missingFixtureStrategy: 'warn',
      logger: { warn },
    });

    const result = rewriter.rewrite('SELECT * FROM users');

    // In 'warn' mode, missing fixtures are reported but not fatal.
    // The rewriter logs a warning (message + context) and returns the original SQL unchanged.
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/Missing fixture/),
      expect.objectContaining({ table: 'users' }),
    );

    expect(result.sql).toBe('SELECT * FROM users');
  });

  it('accepts per-call overrides via context fixtures', () => {
    const rewriter = new SelectFixtureRewriter({
      schema: registry,
      missingFixtureStrategy: 'passthrough',
    });
    const override = rewriter.rewrite('SELECT * FROM users', {
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 9, name: 'Override', role: 'admin' }],
          schema: schema.users,
        },
      ],
    });
    expect(override.sql.toLowerCase().startsWith('with ')).toBe(true);
    expect(override.fixturesApplied).toEqual(['users']);
  });

  it('preserves top-level header comments and keeps output on one line', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice', role: 'admin' }],
          schema: schema.users,
        },
      ],
    });
    const sql = `/* top header */
-- inline note
SELECT id, name FROM users -- trailing`;
    const result = rewriter.rewrite(sql);
    expect(result.sql.startsWith('/* top header */')).toBe(true);
    expect(result.sql.includes('\n')).toBe(false);
    expect(result.sql).not.toContain('-- inline note');
    expect(result.sql).not.toContain('-- trailing');
  });

  it('injects fixtures into every statement of multi-query SQL', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice', role: 'admin' }],
          schema: schema.users,
        },
      ],
    });
    const multi = `SELECT id FROM users; SELECT role FROM users; SELECT 1;`;
    const result = rewriter.rewrite(multi);
    const statements = result.sql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(3);
    expect(statements[0].toLowerCase().startsWith('with ')).toBe(true);
    expect(statements[1].toLowerCase().startsWith('with ')).toBe(true);
    expect(statements[2].toLowerCase().startsWith('select 1')).toBe(true);
    expect(result.fixturesApplied).toEqual(['users']);

    // Full SQL: fixture CTE injected into each SELECT statement that references the table
    expect(result.sql).toBe(
      "with \"users\" as (select cast(1 as INTEGER) as \"id\", cast('Alice' as TEXT) as \"name\", cast('admin' as TEXT) as \"role\") select \"id\" from \"users\"; with \"users\" as (select cast(1 as INTEGER) as \"id\", cast('Alice' as TEXT) as \"name\", cast('admin' as TEXT) as \"role\") select \"role\" from \"users\"; SELECT 1;");
  });

  it('fails fast on conflicting user-defined CTE names by default', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice', role: 'admin' }],
          schema: schema.users,
        },
      ],
    });
    expect(() =>
      rewriter.rewrite('WITH users AS (SELECT 1) SELECT * FROM users')
    ).toThrowError(`Fixture CTE "users" conflicts with query-defined CTE.`);
  });

  it('overrides user-defined CTEs when configured', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 42, name: 'Override', role: 'owner' }],
          schema: schema.users,
        },
      ],
      cteConflictBehavior: 'override',
    });
    const sql = 'WITH users AS (SELECT 1) SELECT * FROM users';
    const result = rewriter.rewrite(sql);
    expect(result.sql.toLowerCase()).toContain('override');
    expect(result.fixturesApplied).toEqual(['users']);

    // Full SQL: fixture CTE overrides user-defined CTE
    expect(result.sql).toBe(
      'with "users" as (select cast(42 as INTEGER) as "id", cast(\'Override\' as TEXT) as "name", cast(\'owner\' as TEXT) as "role") select * from "users"'
    );
  });
  
  it('honors custom formatter options from options and context', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice', role: 'admin' }],
          schema: schema.users,
        },
      ],
      formatterOptions: { keywordCase: 'upper' },
    });
    const base = rewriter.rewrite('SELECT id FROM users');
    expect(base.sql.startsWith('WITH ')).toBe(true);
    const lower = rewriter.rewrite('SELECT id FROM users', {
      formatterOptions: { keywordCase: 'lower' },
    });
    expect(lower.sql.startsWith('with ')).toBe(true);
  });

  it('throws when analyzer fails under the default behavior', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice', role: 'admin' }],
          schema: schema.users,
        },
      ],
    });
    expect(() => rewriter.rewrite(`UPDATE users SET role = 'user' WHERE id = 1`)).toThrowError(
      QueryRewriteError
    );
  });

  it('skips rewriting when analyzer failure behavior is set to skip', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice', role: 'admin' }],
          schema: schema.users,
        },
      ],
      analyzerFailureBehavior: 'skip',
    });
    const sql = `UPDATE users SET role = 'user' WHERE id = 1`;
    const result = rewriter.rewrite(sql);
    expect(result.sql).toBe(sql);
    expect(result.fixturesApplied).toEqual([]);
  });

  it('allows per-call overrides of analyzer failure behavior', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice', role: 'admin' }],
          schema: schema.users,
        },
      ],
    });
    const sql = `UPDATE users SET role = 'user' WHERE id = 1`;
    const result = rewriter.rewrite(sql, { analyzerFailureBehavior: 'skip' });
    expect(result.sql).toBe(sql);
    expect(result.fixturesApplied).toEqual([]);
  });

  it('injects all fixtures via regex when analyzer failure behavior is inject', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice', role: 'admin' }],
          schema: schema.users,
        },
        {
          tableName: 'orders',
          rows: [{ id: 10, total: 99.5 }],
          schema: schema.orders,
        },
      ],
      analyzerFailureBehavior: 'inject',
    });
    const sql = 'INSERT INTO audit_log DEFAULT VALUES';
    const result = rewriter.rewrite(sql);
    expect(result.sql.startsWith('WITH "users"')).toBe(true);
    expect(result.sql).toContain('"orders" AS');
    expect(result.sql.toLowerCase()).toContain('insert into audit_log');
    expect(result.fixturesApplied).toEqual(['users', 'orders']);
  });

  it('bypasses DCL statements but still rewrites subsequent SELECT statements', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice', role: 'admin' }],
          schema: schema.users,
        },
      ],
    });
    const sql = `set work_mem = '256MB'; SELECT * FROM users;`;
    const result = rewriter.rewrite(sql);
    const normalized = result.sql.toLowerCase();
    expect(normalized.startsWith(`set work_mem = '256mb'`)).toBe(true);
    expect(normalized).toContain('with "users" as');
    expect(result.fixturesApplied).toEqual(['users']);
  });
});
