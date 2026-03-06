import { expect, test } from 'vitest';

import { mapSqlTypeToTs } from '../src/utils/typeMapper';

test('mapSqlTypeToTs treats serial aliases as numbers', () => {
  expect(mapSqlTypeToTs('smallserial')).toBe('number');
  expect(mapSqlTypeToTs('serial2')).toBe('number');
  expect(mapSqlTypeToTs('serial4')).toBe('number');
  expect(mapSqlTypeToTs('serial8')).toBe('number');
});
