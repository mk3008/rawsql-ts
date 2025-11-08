import { describe, expect, it, vi } from 'vitest';
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
});
