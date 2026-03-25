import { expect, test } from 'vitest';
import { analyzeDdlSources, lintDdlSources } from '../src';
import type { DdlLintSource } from '../src';

test('analyzeDdlSources reuses the same parsed stream for lint diagnostics and table analysis', () => {
  const sources: DdlLintSource[] = [
    {
      path: 'ddl/public.sql',
      sql: `
        CREATE TABLE public.users (
          id serial PRIMARY KEY,
          email text NOT NULL
        );

        CREATE INDEX users_email_idx ON public.users(email);
      `
    },
    {
      path: 'ddl/audit.sql',
      sql: `
        ALTER TABLE public.users
          ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
      `
    }
  ];

  const analysis = analyzeDdlSources(sources);

  expect(analysis.createStatements).toHaveLength(1);
  expect(analysis.diagnostics).toEqual(lintDdlSources(sources));
});
