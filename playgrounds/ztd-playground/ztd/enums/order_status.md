# Order Status Enum

Executable domain enumeration for the EC sales order domain.

The values here must align with `sales_order.sales_order_status_code` in `ztd/ddl/ecommerce.sql`.

```sql
/*
Order status values used in the EC domain.
These values represent the lifecycle of an order.
*/
SELECT
  *
FROM
  (
    VALUES
      (1, 'Quote', 1),
      (2, 'Order', 2),
      (3, 'Lost', 3)
  ) AS sales_order_status (
    sales_order_status_code,
    sales_order_status_name,
    sort_order
  );
```
