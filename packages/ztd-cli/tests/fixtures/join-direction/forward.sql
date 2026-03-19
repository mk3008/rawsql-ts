select
  oi.order_item_id,
  o.order_id,
  c.customer_id
from public.order_items oi
join public.orders o
  on o.order_id = oi.order_id
join public.customers c
  on c.customer_id = o.customer_id;
