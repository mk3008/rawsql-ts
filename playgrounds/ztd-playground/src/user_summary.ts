// Provides a per-user rollup of orders and spend for the EC sample domain.
export const userSummarySql = `
SELECT
  u.users_id,
  u.name,
  u.email,
  COUNT(DISTINCT o.orders_id) AS total_orders,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_amount,
  MAX(o.order_date) AS last_order_date
FROM users u
LEFT JOIN orders o ON o.user_id = u.users_id
LEFT JOIN order_items oi ON oi.order_id = o.orders_id
GROUP BY u.users_id, u.name, u.email
ORDER BY u.users_id;
`;
