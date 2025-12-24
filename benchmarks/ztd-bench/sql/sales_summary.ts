// Aggregates monthly revenue for the EC domain using order items and order dates.
export const salesSummarySql = `
SELECT
  to_char(o.sales_order_date, 'YYYY-MM') AS year_month,
  SUM(oi.quantity * oi.unit_price) AS total_revenue
FROM sales_order o
JOIN sales_order_item oi ON oi.sales_order_id = o.sales_order_id
GROUP BY year_month
ORDER BY year_month;
`;
