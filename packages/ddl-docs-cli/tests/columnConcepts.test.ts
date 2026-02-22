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
