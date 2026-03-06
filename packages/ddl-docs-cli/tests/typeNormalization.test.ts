import { expect, test } from 'vitest';

import { normalizePostgresType } from '../src/analyzer/typeNormalization';
import { renderTableMarkdown } from '../src/render/tableMarkdown';
import type { TableDocModel } from '../src/types';

test('normalizePostgresType treats serial aliases consistently', () => {
  expect(normalizePostgresType('smallserial')).toMatchObject({ canonicalType: 'int2', typeKey: 'int2{serial}' });
  expect(normalizePostgresType('serial2')).toMatchObject({ canonicalType: 'int2', typeKey: 'int2{serial}' });
  expect(normalizePostgresType('serial4')).toMatchObject({ canonicalType: 'int4', typeKey: 'int4{serial}' });
  expect(normalizePostgresType('serial8')).toMatchObject({ canonicalType: 'int8', typeKey: 'int8{serial}' });
});

test('renderTableMarkdown marks extended serial aliases as sequence columns', () => {
  const table: TableDocModel = {
    schema: 'public',
    table: 'example',
    schemaSlug: 'public',
    tableSlug: 'example',
    instance: 'main',
    tableComment: '',
    sourceFiles: ['ztd/ddl/public.sql'],
    columns: [
      {
        name: 'id',
        concept: 'id',
        conceptSlug: 'id',
        typeName: 'serial8',
        canonicalType: 'int8',
        typeKey: 'int8{serial}',
        nullable: false,
        defaultValue: '',
        isPrimaryKey: true,
        comment: '',
        checks: [],
        unknownType: false,
      },
    ],
    primaryKey: ['id'],
    constraints: [],
    triggers: [],
    outgoingReferences: [],
    incomingReferences: [],
    normalizedSql: {
      definition: 'create table public.example (id bigserial primary key);',
      comments: '',
      triggers: '',
    },
  };

  const markdown = renderTableMarkdown(table, { columnCommentSql: [], foreignKeySql: [] });
  const serialLine = markdown.split('\n').find((line) => line.includes('serial8'));
  expect(serialLine).toContain('YES');
  expect(serialLine).toContain('usages');
});