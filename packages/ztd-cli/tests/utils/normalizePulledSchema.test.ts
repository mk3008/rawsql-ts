import { expect, test } from 'vitest';
import { normalizePulledSchema } from '../../src/utils/normalizePulledSchema';

test('normalizePulledSchema extracts relevant statements per schema', () => {
  const sampleDump = `
    -- PostgreSQL database dump
    SET statement_timeout = 0;
    SET lock_timeout = 0;
    \\connect test
    \\restrict
    \\unrestrict
    CREATE SCHEMA public;
    CREATE TABLE public.products (
      id serial PRIMARY KEY,
      name text NOT NULL
    );
    CREATE VIEW public.product_view AS
      SELECT id, name FROM public.products;
    ALTER TABLE public.products ADD CONSTRAINT products_name_unique UNIQUE (name);
    ALTER TABLE public.products ALTER COLUMN name SET DEFAULT 'unknown';
    CREATE SEQUENCE public.products_id_seq;
    ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;
    CREATE INDEX idx_products_name ON public.products (name);
    SELECT pg_catalog.setval('public.products_id_seq', 1, false);
    DROP TABLE IF EXISTS ignored;
  `;

  const normalized = normalizePulledSchema(sampleDump);
  expect(normalized.size).toBe(1);
  const statements = normalized.get('public');
  expect(statements).toBeTruthy();
  const groups = statements?.map((entry) => entry.group) ?? [];
  expect(groups).toEqual([
    'createSchema',
    'createTable',
    'view',
    'alterTable',
    'alterTable',
    'sequence',
    'sequence',
    'index'
  ]);

  const content = (statements ?? []).map((entry) => entry.sql.toLowerCase()).join('\n');
  expect(content).toContain('create schema public;');
  expect(content).toContain('create table "public"."products"');
  expect(content).toContain('create view public.product_view');
  expect(content).toContain('create index');
  expect(content).not.toContain('drop table');
});
