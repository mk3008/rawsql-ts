# Active Order

## Spec

- Consider orders with status 'Quote' and 'Order' as active orders.
- Sort by order date descending, then by id descending

```sql
SELECT
  *
FROM
  sales_order o
  INNER JOIN customer c ON c.customer_id = o.customer_id
WHERE
  o.sales_order_status_code in (1, 2) -- 1:Quote, 2:Order
ORDER BY
  o.sales_order_date DESC,
  o.sales_order_id DESC;
```
