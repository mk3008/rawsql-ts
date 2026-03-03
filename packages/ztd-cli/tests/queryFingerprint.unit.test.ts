import { expect, test } from 'vitest';
import { buildCatalogStatements } from '../src/utils/sqlCatalogStatements';
import { createQueryFingerprint, normalizeQueryFingerprintSource } from '../src/utils/queryFingerprint';

test('normalizeQueryFingerprintSource uses stable normalization rules', () => {
  expect(normalizeQueryFingerprintSource(`
    -- comment
    SELECT  id
    FROM users /* block */
    WHERE active = 1
  `)).toMatchInlineSnapshot(`"SELECT id FROM users WHERE active = 1"`);
});

test('query fingerprint collapses equivalent whitespace and comment variants', () => {
  const a = createQueryFingerprint('SELECT id FROM users WHERE active = 1');
  const b = createQueryFingerprint(`
    -- leading
    SELECT   id
    FROM users
    /* inline */
    WHERE active = 1
  `);
  expect(a).toBe(b);
});

test('query fingerprint distinguishes different statements', () => {
  expect(createQueryFingerprint('SELECT id FROM users')).not.toBe(
    createQueryFingerprint('SELECT email FROM users')
  );
});

test('buildCatalogStatements uses 1-based indexes, file-relative offsets, and stable fingerprints', () => {
  const sql = [
    '-- comment',
    'SELECT id FROM users;',
    '',
    'SELECT email FROM users WHERE active = 1;'
  ].join('\n');

  const statements = buildCatalogStatements({
    catalogId: 'catalog.users',
    sqlFile: 'src/sql/users.sql',
    sqlText: sql
  });

  expect(statements.map((statement) => ({
    queryId: statement.queryId,
    index: statement.statementIndex,
    offset: statement.statementStartOffsetInFile,
    fingerprint: statement.statementFingerprint,
    statementText: statement.statementText
  }))).toEqual([
    {
      queryId: 'catalog.users:1',
      index: 1,
      offset: 0,
      fingerprint: '6cb80ffe674e',
      statementText: '-- comment\nSELECT id FROM users'
    },
    {
      queryId: 'catalog.users:2',
      index: 2,
      offset: 32,
      fingerprint: '802a04ff843f',
      statementText: 'SELECT email FROM users WHERE active = 1'
    }
  ]);
});
