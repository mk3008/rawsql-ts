import { expect, test } from 'vitest';
import { snapshotTableDocs } from '../src/parser/snapshotTableDocs';
import type { SqlSource } from '../src/types';

test('aggregates CREATE TABLE and ALTER TABLE constraints across full DDL', () => {
  const sources: SqlSource[] = [
    {
      path: 'ztd/ddl/public.sql',
      sql: `
        CREATE TABLE users (
          id bigint NOT NULL,
          email text NOT NULL,
          age int,
          created_at timestamptz default now(),
          CONSTRAINT users_email_chk CHECK (email <> '')
        );

        ALTER TABLE users
          ADD CONSTRAINT users_pkey PRIMARY KEY (id),
          ADD CONSTRAINT users_age_chk CHECK (age > 0);

        COMMENT ON TABLE users IS 'user profile';
        COMMENT ON COLUMN users.email IS 'login mail';
      `,
    },
  ];

  const snapshot = snapshotTableDocs(sources, { defaultSchema: 'public', searchPath: ['public'] }, { columnOrder: 'definition' });
  expect(snapshot.warnings).toHaveLength(0);
  const table = snapshot.tables[0];
  expect(table.schema).toBe('public');
  expect(table.table).toBe('users');
  expect(table.tableComment).toBe('user profile');
  expect(table.primaryKey).toEqual(['id']);
  expect(table.constraints.find((constraint) => constraint.kind === 'CHECK')?.expression).toContain('"age" > 0');
  expect(table.columns.find((column) => column.name === 'id')?.isPrimaryKey).toBe(true);
  expect(table.columns.find((column) => column.name === 'email')?.comment).toBe('login mail');
});
