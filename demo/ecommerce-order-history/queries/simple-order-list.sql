-- Simple flat order list for comparison
-- This shows regular SQL results vs PostgresJsonQueryBuilder magic

SELECT 
    o.order_id,
    o.order_date,
    o.total_amount,
    o.status,
    c.customer_name
FROM orders o
    INNER JOIN customers c ON o.customer_id = c.customer_id
ORDER BY o.order_id
LIMIT 5;
