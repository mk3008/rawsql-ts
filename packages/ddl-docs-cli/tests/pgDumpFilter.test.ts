import { describe, expect, it } from 'vitest';

import { filterPgDump } from '../src/utils/pgDumpFilter';

describe('filterPgDump', () => {
  it('filters pg_dump administrative statements and keeps schema DDL', () => {
    const input = [
      'SET search_path = public, pg_catalog;',
      "SELECT pg_catalog.set_config('search_path', '', false);",
      '\\connect my_db',
      'GRANT USAGE ON SCHEMA public TO app_role;',
      'REVOKE ALL ON SCHEMA public FROM PUBLIC;',
      'ALTER TABLE public.users OWNER TO app_owner;',
      'CREATE TABLE public.users (',
      '  id bigint PRIMARY KEY,',
      '  email text NOT NULL',
      ');',
      '',
      'GRANT',
      '  SELECT',
      'ON TABLE public.users',
      'TO app_role;',
      '',
      'CREATE INDEX users_email_idx ON public.users (email);',
    ].join('\n');

    const output = filterPgDump(input);

    expect(output).toContain('CREATE TABLE public.users (');
    expect(output).toContain('CREATE INDEX users_email_idx ON public.users (email);');
    expect(output).not.toContain('SET search_path');
    expect(output).not.toContain('pg_catalog.set_config');
    expect(output).not.toContain('\\connect');
    expect(output).not.toContain('GRANT');
    expect(output).not.toContain('REVOKE');
    expect(output).not.toContain('OWNER TO');
  });

  it('is idempotent when applied multiple times', () => {
    const input = [
      'SET statement_timeout = 0;',
      'CREATE TABLE public.events (id bigint PRIMARY KEY);',
      'GRANT SELECT ON TABLE public.events TO app_role;',
    ].join('\n');

    const once = filterPgDump(input);
    const twice = filterPgDump(once);

    expect(twice).toBe(once);
  });

  it('does not terminate skip mode on semicolons inside string literals', () => {
    const input = [
      'GRANT',
      "  SELECT ON TABLE public.users TO 'role;name'",
      '  WITH GRANT OPTION;',
      'CREATE TABLE public.audit_log (id bigint PRIMARY KEY);',
    ].join('\n');

    const output = filterPgDump(input);
    expect(output).toContain('CREATE TABLE public.audit_log');
    expect(output).not.toContain('GRANT');
    expect(output).not.toContain('role;name');
  });
});
