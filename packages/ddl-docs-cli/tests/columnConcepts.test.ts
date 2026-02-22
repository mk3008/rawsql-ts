import { expect, test } from 'vitest';
import { analyzeColumns } from '../src/analyzer/columnConcepts';
import { snapshotTableDocs } from '../src/parser/snapshotTableDocs';
import type { SqlSource } from '../src/types';

const schemaSettings = { defaultSchema: 'public', searchPath: ['public'] };

test('reports type variation as info when a concept uses int4 and int8', () => {
  const sources: SqlSource[] = [
    {
      path: 'ztd/ddl/public.sql',
      sql: `
        CREATE TABLE public.t1 (
          age int
        );
        CREATE TABLE public.t2 (
          age bigint
        );
      `,
    },
  ];

  const snapshot = snapshotTableDocs(sources, schemaSettings, { columnOrder: 'definition' });
  const analysis = analyzeColumns(snapshot.tables, { locale: 'en', dictionary: null });
  const divergence = analysis.findings.find((item) => item.kind === 'COLUMN_NAME_TYPE_DIVERGENCE');

  expect(divergence).toBeDefined();
  expect(divergence?.severity).toBe('info');
  expect(divergence?.message).toBe('Type variation detected for concept "age".');
});

test('does not report type variation for bigint and bigserial aliases', () => {
  const sources: SqlSource[] = [
    {
      path: 'ztd/ddl/public.sql',
      sql: `
        CREATE TABLE public.t1 (
          user_id bigserial PRIMARY KEY
        );
        CREATE TABLE public.t2 (
          user_id bigint PRIMARY KEY
        );
      `,
    },
  ];

  const snapshot = snapshotTableDocs(sources, schemaSettings, { columnOrder: 'definition' });
  const analysis = analyzeColumns(snapshot.tables, { locale: 'en', dictionary: null });

  expect(analysis.findings.some((item) => item.kind === 'COLUMN_NAME_TYPE_DIVERGENCE')).toBe(false);
});

test('suggests missing column comments with schema-first and stable fallback order', () => {
  const sources: SqlSource[] = [
    {
      path: 'ztd/ddl/public.sql',
      sql: `
        CREATE TABLE public.orders (
          note text
        );
        CREATE TABLE public.order_templates (
          note text
        );
        COMMENT ON COLUMN public.order_templates.note IS 'B comment';

        CREATE TABLE public.order_archives (
          note text
        );
        COMMENT ON COLUMN public.order_archives.note IS 'A comment';

        CREATE TABLE sales.orders (
          note text
        );

        CREATE TABLE master.orders (
          note text
        );
        COMMENT ON COLUMN master.orders.note IS 'M comment';
      `,
    },
  ];

  const snapshot = snapshotTableDocs(sources, schemaSettings, { columnOrder: 'definition' });
  const analysis = analyzeColumns(snapshot.tables, { locale: 'en', dictionary: null });

  const publicSuggestion = analysis.suggestions.find(
    (item) => item.kind === 'column_comment' && item.schema === 'public' && item.table === 'orders' && item.column === 'note'
  );
  const salesSuggestion = analysis.suggestions.find(
    (item) => item.kind === 'column_comment' && item.schema === 'sales' && item.table === 'orders' && item.column === 'note'
  );

  expect(publicSuggestion?.sql).toContain(`IS 'A comment';`);
  expect(salesSuggestion?.sql).toContain(`IS 'M comment';`);
});
