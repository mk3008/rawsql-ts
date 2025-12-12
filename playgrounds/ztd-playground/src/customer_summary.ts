// Provides a per-customer rollup of orders and spend for the EC sample domain.
export const customerSummarySql = `
SELECT
  c.customer_id,
  c.customer_name,
  c.customer_email,
  COUNT(DISTINCT o.sales_order_id) AS total_orders,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_amount,
  MAX(o.sales_order_date) AS last_order_date
FROM customer c
LEFT JOIN sales_order o ON o.customer_id = c.customer_id
LEFT JOIN sales_order_item oi ON oi.sales_order_id = o.sales_order_id
GROUP BY c.customer_id, c.customer_name, c.customer_email
ORDER BY c.customer_id;
`;
