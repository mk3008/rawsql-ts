import { describe, expect, it } from 'vitest';
import {
  applyTypeCastsToSelect,
  normalizeInsertValuesToSelect,
  validateDtoSelectRuntime,
  validateInsertShape,
  TableDef,
} from '../../src/cud/helpers';
import type { InsertQuery, SelectQuery, SimpleSelectQuery } from 'rawsql-ts';
import { SqlParser } from 'rawsql-ts';

describe('CUD helper functions', () => {
  const userTable: TableDef = {
    tableName: 'users',
    columns: [
      { name: 'id', dbType: 'INTEGER', nullable: false },
      { name: 'email', dbType: 'TEXT', nullable: false },
      { name: 'status', dbType: 'TEXT', nullable: true, hasDefault: true },
    ],
  };

  it('normalizeInsertValuesToSelect rewrites VALUES into a SELECT over the VALUES source', () => {
    const insert = SqlParser.parse("INSERT INTO users (id, email) VALUES (1, 'alice@example.com')") as InsertQuery;
    const normalized = normalizeInsertValuesToSelect(insert);

    const normalizedSelect = normalized.selectQuery as SimpleSelectQuery;
    const clauseItems = normalizedSelect.selectClause.items;
    const aliases = clauseItems.map((item) => item.identifier?.name);

    expect(normalizedSelect.fromClause).toBeTruthy();
    expect(aliases).toEqual(['id', 'email']);
  });

  it('normalizeInsertValuesToSelect respects parameterized VALUES and preserves column order', () => {
    const insert = SqlParser.parse('INSERT INTO users (email, id) VALUES (:email, :id)') as InsertQuery;
    const normalized = normalizeInsertValuesToSelect(insert);

    const normalizedSelect = normalized.selectQuery as SimpleSelectQuery;
    const aliases = normalizedSelect.selectClause.items.map((item) => item.identifier?.name);
    expect(aliases).toEqual(['email', 'id']);
  });

  it('applyTypeCastsToSelect wraps each select item with a CAST for the table def', () => {
    const select = (SqlParser.parse('SELECT id, email FROM users') as SelectQuery).toSimpleQuery();

    applyTypeCastsToSelect(select, userTable);
    const items = select.selectClause.items;
    expect(items.every((item) => item.value.constructor.name === 'CastExpression')).toBe(true);
  });

  it('applyTypeCastsToSelect throws when a column is missing from the table def', () => {
    const select = (SqlParser.parse('SELECT foo FROM users') as SelectQuery).toSimpleQuery();
    expect(() => applyTypeCastsToSelect(select, userTable)).toThrow(/not defined/);
  });

  it('validateInsertShape reports missing required columns and extra columns', () => {
    const missing = SqlParser.parse("INSERT INTO users (email) VALUES ('bob@example.com')") as InsertQuery;
    const missingIssues = validateInsertShape(missing, userTable);
    expect(missingIssues.some((issue) => issue.kind === 'RequiredColumnMissing')).toBe(true);

    const extra = SqlParser.parse("INSERT INTO users (id, email, role) VALUES (1, 'carol@example.com', 'admin')") as InsertQuery;
    const extraIssues = validateInsertShape(extra, userTable);
    expect(extraIssues.some((issue) => issue.kind === 'ExtraColumn')).toBe(true);
  });

  it('validateDtoSelectRuntime flags FROM-less selects', () => {
    const dtoSelect = (SqlParser.parse("SELECT 1 AS id, 'x' AS email") as SelectQuery).toSimpleQuery();
    const issues = validateDtoSelectRuntime(dtoSelect, userTable);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe('RuntimeDtoWithoutFrom');
  });

  it('validateDtoSelectRuntime passes when FROM is present', () => {
    const dtoSelect = (SqlParser.parse('SELECT id, email FROM users') as SelectQuery).toSimpleQuery();
    const issues = validateDtoSelectRuntime(dtoSelect, userTable);
    expect(issues).toHaveLength(0);
  });
});
