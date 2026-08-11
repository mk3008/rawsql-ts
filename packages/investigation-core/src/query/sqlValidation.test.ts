import { describe, expect, it } from 'vitest';
import { validateSql } from './sqlValidation';

const ddl = [{ filePath: 'schema/orders.sql', sql: 'create table public.orders (order_id bigint not null, amount numeric);' }];

describe('validateSql', () => {
  it('returns parse-only validity with an explicit limitation when DDL is absent', () => {
    expect(validateSql({ sql: 'select 1 as value' })).toEqual({
      diagnostics: [expect.objectContaining({ code: 'SCHEMA_VALIDATION_SKIPPED', severity: 'warning' })],
      kind: 'sql-validation',
      parserVersion: 'rawsql-ts',
      valid: true,
      version: 1,
    });
  });

  it('treats an empty DDL array the same as omitted DDL', () => {
    expect(validateSql({ ddl: [], sql: 'select id from missing' }))
      .toEqual(validateSql({ sql: 'select id from missing' }));
  });

  it.each([
    ['without DDL', undefined],
    ['with DDL', ddl],
  ])('returns VALUES %s as a structured schema-validation limitation', (_label, inputDdl) => {
    const result = validateSql({ ...(inputDdl ? { ddl: inputDdl } : {}), sql: 'values (1), (2)' });

    expect(result).toMatchObject({
      valid: true,
      diagnostics: expect.arrayContaining([expect.objectContaining({
        category: 'limitation',
        code: 'SCHEMA_VALIDATION_UNSUPPORTED_QUERY_ROOT',
        severity: 'warning',
      })]),
    });
  });

  it('returns structured table and column diagnostics from schema validation', () => {
    const unknownTable = validateSql({ ddl, sql: 'select id from public.missing' });
    const unknownColumn = validateSql({ ddl, sql: 'select missing from public.orders' });

    expect(unknownTable).toMatchObject({
      valid: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'TABLE_NOT_DEFINED', tableName: 'public.missing' })]),
    });
    expect(unknownColumn).toMatchObject({
      valid: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'COLUMN_NOT_DEFINED', columnName: 'missing' })]),
    });
  });

  it('returns syntax failures as domain diagnostics', () => {
    expect(validateSql({ sql: 'select from' })).toMatchObject({
      valid: false,
      diagnostics: [expect.objectContaining({ category: 'syntax', code: 'SQL_PARSE_ERROR', severity: 'error' })],
    });
  });

  it('distinguishes unique, ambiguous, and unresolved unqualified-column ownership', () => {
    const unique = validateSql({
      ddl: [{ sql: 'create table users (id bigint); create table accounts (user_id bigint);' }],
      sql: 'select id from users join accounts on users.id = accounts.user_id',
    });
    const ambiguous = validateSql({
      ddl: [{ sql: 'create table users (id bigint); create table accounts (id bigint, user_id bigint);' }],
      sql: 'select id from users join accounts on users.id = accounts.user_id',
    });
    const unresolved = validateSql({
      ddl: [{ sql: 'create table users (id bigint); create table accounts (user_id bigint);' }],
      sql: 'select id from (select id from users) user_scope join accounts on user_scope.id = accounts.user_id',
    });

    expect(unique).toMatchObject({ valid: true, diagnostics: [] });
    expect(ambiguous).toMatchObject({
      valid: false,
      diagnostics: expect.arrayContaining([expect.objectContaining({
        code: 'COLUMN_REFERENCE_AMBIGUOUS',
        columnNames: ['id'],
      })]),
    });
    expect(unresolved).toMatchObject({
      valid: true,
      diagnostics: expect.arrayContaining([expect.objectContaining({
        category: 'limitation',
        code: 'COLUMN_REFERENCE_UNRESOLVED',
        severity: 'warning',
      })]),
    });
  });
});
