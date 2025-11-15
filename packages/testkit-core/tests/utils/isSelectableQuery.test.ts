import { describe, expect, it } from 'vitest';
import { isSelectableQuery } from '../../src/utils/isSelectableQuery';

describe('isSelectableQuery', () => {
  it('returns true for a basic SELECT statement', () => {
    expect(isSelectableQuery('SELECT id, email FROM users')).toBe(true);
  });

  it('returns false for an INSERT that starts with a WITH clause', () => {
    const sql = `
      WITH candidates AS (
        SELECT id, email FROM users WHERE is_active = true
      )
      INSERT INTO archived_users (id, email)
      SELECT id, email FROM candidates;
    `;
    expect(isSelectableQuery(sql)).toBe(false);
  });

  it('returns false for DML preceded by a comment', () => {
    const sql = `
      -- purge inactive users
      DELETE FROM users WHERE is_active = false;
    `;
    expect(isSelectableQuery(sql)).toBe(false);
  });
});
