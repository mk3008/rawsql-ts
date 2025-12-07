// Lists products ordered by cumulative revenue to highlight best sellers.
export const productRankingSql = `
SELECT
  p.products_id,
  p.name,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.products_id
GROUP BY p.products_id, p.name
ORDER BY total_revenue DESC, p.products_id;
`;
