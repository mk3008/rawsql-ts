import { describe, expect, it, vi } from 'vitest';
import { MissingFixtureError } from '../src/errors';
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
  });
  it('merges fixture definitions with user-defined WITH clauses', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Temp', role: 'admin' }],
          schema: schema.users,
        },
      ],
    });
    const sql = `WITH source AS (SELECT * FROM users) SELECT * FROM source`;
    const rewritten = rewriter.rewrite(sql);
    expect(rewritten.sql).toMatch(/with\s+"users"\s+as/i);
    expect(rewritten.sql.indexOf('"users"')).toBeLessThan(rewritten.sql.indexOf('"source"'));
  });
  it('throws when fixtures are missing under the default strategy', () => {
    const rewriter = new SelectFixtureRewriter({
      schema: registry,
    });
    expect(() => rewriter.rewrite('SELECT * FROM users')).toThrowError(/Fixture/);
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
    expect(warn).toHaveBeenCalled();
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
    ).toThrowError(/conflicts/i);
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
  it('falls back to regex injection when AST parsing fails, injecting all fixtures', () => {
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
    });
    const sql = 'INSERT INTO audit_log DEFAULT VALUES';
    const result = rewriter.rewrite(sql);
    expect(result.sql.startsWith('WITH "users"')).toBe(true);
    expect(result.sql).toContain('"orders" AS');
    expect(result.fixturesApplied).toEqual(['users', 'orders']);
  });
});
