// Aggregates monthly revenue for the EC domain using order items and order dates.
export const salesSummarySql = `
SELECT
  to_char(o.order_date, 'YYYY-MM') AS year_month,
  SUM(oi.quantity * oi.unit_price) AS total_revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.orders_id
GROUP BY year_month
ORDER BY year_month;
`;
