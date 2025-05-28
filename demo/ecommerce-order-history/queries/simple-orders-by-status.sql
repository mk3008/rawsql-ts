-- Simple orders with hierarchical data for PostgresJsonQueryBuilder demo
-- This query fetches orders with customer and order items
-- PostgresJsonQueryBuilder will automatically create nested JSON structure

SELECT 
    o.order_id,
    o.order_date,
    o.total_amount,
    o.status,
    -- Customer data (will become nested object)
    c.customer_id,
    c.customer_name,
    c.email,
    c.address,
    -- Order item data (will become nested array)
    oi.order_item_id,
    oi.product_id,
    oi.product_name,
    oi.category_id,
    oi.price,
    oi.quantity
FROM orders o
    INNER JOIN customers c ON o.customer_id = c.customer_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
-- SqlParamInjector will dynamically inject search conditions based on parameters
-- Use placeholder comments that SqlParamInjector can replace with actual WHERE conditions
/* WHERE_PLACEHOLDER */
ORDER BY o.order_id, oi.order_item_id;
