// Lists products ordered by cumulative revenue to highlight best sellers.
export const productRankingSql = `
SELECT
  p.product_id,
  p.product_name,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
FROM product p
LEFT JOIN sales_order_item oi ON oi.product_id = p.product_id
GROUP BY p.product_id, p.product_name
ORDER BY total_revenue DESC, p.product_id;
`;
