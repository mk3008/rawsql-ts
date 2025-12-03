import { expect, test } from 'vitest';
import { parseExtensions } from '../src/commands/ddl';

test('parseExtensions normalizes CLI extension arguments and returns a sorted list', () => {
  // Provide a variety of casing and whitespace so normalization logic is exercised.
  const list = parseExtensions('SQL, .ddl ,json , ,TXT');

  expect(list).toEqual(['.ddl', '.json', '.sql', '.txt']);
});

test('parseExtensions drops blank entries and dedupes extensions regardless of dot or casing', () => {
  const list = parseExtensions('sql,,SQL, .json, JSON,');

  expect(list).toEqual(['.json', '.sql']);
});

test('parseExtensions accepts arrays and normalizes each entry before deduplicating', () => {
  const list = parseExtensions(['SQL', '.Sql', 'sQl', 'json']);

  expect(list).toEqual(['.json', '.sql']);
});

test('parseExtensions rejects tokens with invalid characters and standalone dot entries', () => {
  const list = parseExtensions('SQL, *, ., ???, json');

  expect(list).toEqual(['.json', '.sql']);
});

test('parseExtensions applies the same validation path to array inputs', () => {
  const list = parseExtensions(['.SQL', '??', '.', '.Json', '_ok']);

  expect(list).toEqual(['._ok', '.json', '.sql']);
});
