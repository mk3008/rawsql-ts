import { describe, expect, it } from 'vitest';
import { exportSqlCatalogEvidence } from './utils/sqlCatalog';
import { activeOrdersSqlCases } from './specs/sql/activeOrders';

describe('sql catalog evidence', () => {
  it('is deterministic with stable sorting and normalized SQL', () => {
    const unsorted = [activeOrdersSqlCases];
    const exported1 = exportSqlCatalogEvidence([...unsorted]);
    const exported2 = exportSqlCatalogEvidence([...unsorted]);

    expect(exported1).toEqual(exported2);
    expect(exported1.catalogs.map((item) => item.id)).toEqual(['sql.active-orders']);
    expect(exported1.catalogs[0]?.cases.map((item) => item.id)).toEqual([
      'baseline',
      'inactive-variant',
    ]);
    expect(exported1.catalogs[0]?.cases).toEqual([
      {
        id: 'baseline',
        title: 'active users with minimum total',
        expected: [
          { orderId: 10, userEmail: 'alice@example.com', orderTotal: 50 },
          { orderId: 13, userEmail: 'carol@example.com', orderTotal: 35 },
        ],
      },
      {
        id: 'inactive-variant',
        title: 'inactive users return a different result',
        expected: [{ orderId: 12, userEmail: 'bob@example.com', orderTotal: 40 }],
      },
    ]);
    expect(exported1.catalogs[0]?.sql.includes('\r\n')).toBe(false);
    expect(exported1.catalogs[0]?.fixtures).toEqual([
      { rowsCount: 4, tableName: 'orders', schema: { columns: { id: 'INTEGER', total: 'INTEGER', user_id: 'INTEGER' } } },
      { rowsCount: 3, tableName: 'users', schema: { columns: { active: 'INTEGER', email: 'TEXT', id: 'INTEGER' } } },
    ]);
  });
});
