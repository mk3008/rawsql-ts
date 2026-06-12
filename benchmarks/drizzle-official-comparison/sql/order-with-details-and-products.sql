select
  o.id,
  to_char(o.order_date, 'YYYY-MM-DD"T"00:00:00"Z"') as "orderDate",
  to_char(o.required_date, 'YYYY-MM-DD"T"00:00:00"Z"') as "requiredDate",
  to_char(o.shipped_date, 'YYYY-MM-DD"T"00:00:00"Z"') as "shippedDate",
  o.ship_via as "shipVia",
  o.freight,
  o.ship_name as "shipName",
  o.ship_city as "shipCity",
  o.ship_region as "shipRegion",
  o.ship_postal_code as "shipPostalCode",
  o.ship_country as "shipCountry",
  o.customer_id as "customerId",
  o.employee_id as "employeeId",
  d.unit_price as "detail_unitPrice",
  d.quantity as "detail_quantity",
  d.discount as "detail_discount",
  d.order_id as "detail_orderId",
  d.product_id as "detail_productId",
  p.id as "product_id",
  p.name as "product_name",
  p.quantity_per_unit as "product_quantityPerUnit",
  p.unit_price as "product_unitPrice",
  p.units_in_stock as "product_unitsInStock",
  p.units_on_order as "product_unitsOnOrder",
  p.reorder_level as "product_reorderLevel",
  p.discontinued as "product_discontinued",
  p.supplier_id as "product_supplierId"
from orders o
left join order_details d on d.order_id = o.id
left join products p on p.id = d.product_id
where o.id = $1
order by d.product_id
