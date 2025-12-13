import { expect, test } from 'vitest';
import {
  normalizeDirectoryList,
  parseExtensions,
  resolveExtensions,
  DEFAULT_DDL_DIRECTORY,
  DEFAULT_EXTENSIONS
} from '../src/commands/options';

test('normalizeDirectoryList respects user directories and falls back when absent', () => {
  const provided = ['ztd/ddl', 'schema'];
  const normalized = normalizeDirectoryList(provided, DEFAULT_DDL_DIRECTORY);
  expect(normalized).toEqual(['ztd/ddl', 'schema']);

  const fallback = normalizeDirectoryList([], DEFAULT_DDL_DIRECTORY);
  expect(fallback).toEqual([DEFAULT_DDL_DIRECTORY]);
});

test('normalizeDirectoryList removes duplicates', () => {
  const normalized = normalizeDirectoryList(['ztd/ddl', 'ztd/ddl', 'schema'], DEFAULT_DDL_DIRECTORY);
  expect(normalized).toEqual(['ztd/ddl', 'schema']);
});

test('parseExtensions normalizes CLI extension arguments and ignores invalid tokens', () => {
  const list = parseExtensions('SQL, .ddl ,json , ,TXT, ???');
  expect(list).toEqual(['.ddl', '.json', '.sql', '.txt']);
});

test('parseExtensions accepts array inputs and deduplicates case-insensitively', () => {
  const list = parseExtensions(['SQL', '.Sql', 'json']);
  expect(list).toEqual(['.json', '.sql']);
});

test('resolveExtensions falls back to defaults when none provided', () => {
  expect(resolveExtensions(undefined, DEFAULT_EXTENSIONS)).toEqual(DEFAULT_EXTENSIONS);
});

test('resolveExtensions respects provided extensions when available', () => {
  const extensions = ['.sql', '.ddl'];
  expect(resolveExtensions(extensions, DEFAULT_EXTENSIONS)).toEqual(['.sql', '.ddl']);
});
