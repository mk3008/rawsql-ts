select
  c.customer_id,
  o.order_id
from public.customers c
join public.orders o
  on o.customer_id = c.customer_id;
