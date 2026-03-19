select
  c.customer_id,
  count(o.order_id) as order_count
from public.customers c
left join public.orders o
  on o.customer_id = c.customer_id
group by c.customer_id;
