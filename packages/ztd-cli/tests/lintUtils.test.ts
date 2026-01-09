import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  resolveSqlFiles,
  extractEnumLabels,
  inferDefaultValue
} from '../src/utils/sqlLintHelpers';
import { buildParserFailure } from '../src/commands/lint';

function createTempDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

const toPosixPath = (value: string): string => value.replace(/\\/g, '/');

test('resolveSqlFiles resolves files, directories, and glob patterns', () => {
  const workspace = createTempDir('ztd-lint');
  const topFile = path.join(workspace, 'top.sql');
  mkdirSync(path.join(workspace, 'nested'), { recursive: true });
  const nestedFile = path.join(workspace, 'nested', 'detail.sql');
  writeFileSync(topFile, 'select 1');
  writeFileSync(nestedFile, 'select 2');

  const directoryMatch = resolveSqlFiles(workspace);
  expect(directoryMatch).toEqual(
    expect.arrayContaining([toPosixPath(topFile), toPosixPath(nestedFile)])
  );

  const globMatch = resolveSqlFiles(path.join(workspace, '**', '*.sql'));
  expect(globMatch).toEqual(
    expect.arrayContaining([toPosixPath(nestedFile), toPosixPath(topFile)])
  );

  const fileMatch = resolveSqlFiles(topFile);
  expect(fileMatch).toEqual([toPosixPath(topFile)]);
});

test('extractEnumLabels returns normalized enum keys', () => {
  const workspace = createTempDir('ztd-lint-enum');
  const ddlDir = path.join(workspace, 'ztd', 'ddl');
  mkdirSync(ddlDir, { recursive: true });
  writeFileSync(
    path.join(ddlDir, 'status.sql'),
    `
    CREATE TYPE public.status AS ENUM (
      'pending',
      'done'
    );
    `
  );

  const enums = extractEnumLabels([ddlDir]);
  expect(enums.has('public.status')).toBe(true);
  expect(enums.get('public.status')).toEqual(['pending', 'done']);
});

test('inferDefaultValue returns type-specific fixtures', () => {
  const enumMap = new Map([
    ['public.status', ['pending', 'done']]
  ]);
  expect(inferDefaultValue('integer', enumMap)).toBe(0);
  expect(inferDefaultValue('boolean', enumMap)).toBe(false);
  expect(inferDefaultValue('public.status', enumMap)).toBe('pending');
  expect(inferDefaultValue('character varying', enumMap)).toBe('');
  expect(inferDefaultValue('timestamp with time zone', enumMap)).toBe('1970-01-01 00:00:00');
  expect(inferDefaultValue('uuid', enumMap)).toBe('00000000-0000-0000-0000-000000000000');
  const numericArrayFixture = inferDefaultValue('numeric[]', enumMap);
  expect(typeof numericArrayFixture).toBe('string');
  expect(numericArrayFixture).toContain('{');
  expect(numericArrayFixture).toContain('}');
});

test('buildParserFailure marks parser kind with parse keyword', () => {
  const error = new Error('unexpected token');
  const failure = buildParserFailure('test.sql', 'select 1', error);
  expect(failure.kind).toBe('parser');
  expect(failure.message.toLowerCase()).toContain('parse');
  expect(failure.details?.code).toBeUndefined();
});
