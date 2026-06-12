import { describe, expect, it } from 'vitest';
import { SelectFixtureRewriter } from '../src/rewriter/SelectFixtureRewriter';
import type { TableSchemaDefinition } from '../src/types';

const schema: Record<string, TableSchemaDefinition> = {
  users: {
    columns: {
      id: 'INTEGER',
      name: 'TEXT',
    },
  },
  orders: {
    columns: {
      id: 'INTEGER',
      user_id: 'INTEGER',
      total: 'REAL',
    },
  },
};

describe('SelectFixtureRewriter fixture shadowing', () => {
  it('shadows a referenced table with a fixture CTE inside a simple select', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice' }],
          schema: schema.users,
        },
      ],
    });

    const result = rewriter.rewrite(`SELECT id, name FROM users WHERE id = 1`);

    expect(result.sql.toLowerCase()).toContain('with "users" as');
    expect(result.sql).toContain(`select "id", "name" from "users"`);
    expect(result.fixturesApplied).toEqual(['users']);
  });

  it('uses a collision-aware alias for schema-qualified fixtures', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'app.users',
          rows: [{ id: 1, name: 'Alice' }],
          schema: {
            columns: {
              id: 'INTEGER',
              name: 'TEXT',
            },
          },
        },
      ],
    });

    const sql = `
      WITH app_users AS (SELECT 99 AS id)
      SELECT app.users.id, app.users.name
      FROM app.users
    `;
    const result = rewriter.rewrite(sql);

    expect(result.sql.toLowerCase()).toContain('with "app__users" as');
    expect(result.sql).toContain('select "app__users"."id", "app__users"."name" from "app__users"');
    expect(result.fixturesApplied).toEqual(['app.users']);
  });

  it('rewrites schema-qualified joins while preserving explicit source aliases', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'app.users',
          rows: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
          schema: {
            columns: {
              id: 'INTEGER',
              name: 'TEXT',
            },
          },
        },
        {
          tableName: 'orders',
          rows: [{ id: 10, user_id: 1, total: 99.5 }],
          schema: {
            columns: {
              id: 'INTEGER',
              user_id: 'INTEGER',
              total: 'REAL',
            },
          },
        },
      ],
    });

    const sql = `
      WITH app_users AS (SELECT 99 AS id)
      SELECT u.name, o.total
      FROM app.users u
      JOIN orders o ON u.id = o.user_id
    `;
    const result = rewriter.rewrite(sql);

    expect(result.sql.toLowerCase()).toContain('with "app__users" as');
    expect(result.sql).toContain(
      'select "u"."name", "o"."total" from "app__users" as "u" join "orders" as "o" on "u"."id" = "o"."user_id"'
    );
  });

  it('produces predictable SQL for the entire rewritten statement', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [{ id: 1, name: 'Alice' }],
          schema: schema.users,
        },
      ],
    });

    const result = rewriter.rewrite(`SELECT id, name FROM users WHERE id = 1`);

    expect(result.sql).toBe(
      'with "users" as (select cast(1 as INTEGER) as "id", cast(\'Alice\' as TEXT) as "name") select "id", "name" from "users" where "id" = 1'
    );
  });

  it('shadows every table that appears in a joined select', () => {
    const rewriter = new SelectFixtureRewriter({
      fixtures: [
        {
          tableName: 'users',
          rows: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
          schema: schema.users,
        },
        {
          tableName: 'orders',
          rows: [{ id: 10, user_id: 1, total: 99.5 }],
          schema: schema.orders,
        },
      ],
    });

    const sql = `SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id`;
    const result = rewriter.rewrite(sql);

    expect(result.sql.toLowerCase()).toContain('with "users" as');
    expect(result.sql.toLowerCase()).toContain('"orders" as');
    expect(result.sql).toContain(
      `select "u"."name", "o"."total" from "users" as "u" join "orders" as "o" on "u"."id" = "o"."user_id"`
    );
    // Sorting ensures the assertion does not depend on fixture discovery order.
    expect([...result.fixturesApplied].sort()).toEqual(['orders', 'users']);
  });
});
