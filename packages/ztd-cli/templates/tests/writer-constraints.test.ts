import { describe, expect, test } from 'vitest';
import { tableSchemas } from './generated/ztd-row-map.generated';
import { userAccountWriterColumnSets } from '../src/repositories/tables/user-accounts';

const userColumns = new Set(
  Object.keys(tableSchemas['public.user_account'].columns),
);

describe('user_account writer columns', () => {
  test('insert columns must exist on the canonical table', () => {
    const { insertColumns } = userAccountWriterColumnSets;
    const missing = insertColumns.filter((column) => !userColumns.has(column));
    expect(missing, `Missing columns: ${missing.join(', ')}`).toEqual([]);
    expect(insertColumns).toEqual(
      expect.arrayContaining(['username', 'email', 'display_name']),
    );
  });

  test('writer column sets align with the canonical table', () => {
    const { updateColumns, immutableColumns } = userAccountWriterColumnSets;
    const missingUpdates = updateColumns.filter((column) => !userColumns.has(column));
    expect(missingUpdates, `Missing update columns: ${missingUpdates.join(', ')}`).toEqual([]);
    const missingImmutables = immutableColumns.filter((column) => !userColumns.has(column));
    expect(missingImmutables, `Missing immutable columns: ${missingImmutables.join(', ')}`).toEqual([]);
    immutableColumns.forEach((column) => {
      expect(
        updateColumns,
        `Immutable column "${column}" should never appear in updateColumns`,
      ).not.toContain(column);
    });
  });
});
