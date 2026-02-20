import { defineSqlCatalogDefinition } from '../sqlCatalogDefinition';

/**
 * SQL definition for listing active user orders in descending total order.
 */
export const activeOrdersCatalog = defineSqlCatalogDefinition<
  { active: number; minTotal: number; limit: number },
  { orderId: number; userEmail: string; orderTotal: number }
>({
  id: 'orders.active-users.list',
  params: {
    shape: 'named',
    example: { active: 1, minTotal: 20, limit: 2 },
  },
  output: {
    mapping: {
      columnMap: {
        orderId: 'order_id',
        userEmail: 'user_email',
        orderTotal: 'order_total',
      },
    },
  },
  sql: `
      SELECT
        o.id AS order_id,
        u.email AS user_email,
        o.total AS order_total
      FROM orders o
      INNER JOIN users u ON u.id = o.user_id
      WHERE u.active = @active
        AND o.total >= @minTotal
      ORDER BY o.total DESC
      LIMIT @limit
    `,
});
