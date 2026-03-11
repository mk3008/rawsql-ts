export const SQL_DEBUG_RECOVERY_QUERY = `with source_orders as (
  select order_id, customer_id, amount, region_id, order_date
  from public.orders
),
filtered_orders as (
  select *
  from source_orders
  where region_id = :region_id
),
customer_rollup as (
  select customer_id, sum(amount) as total_amount
  from filtered_orders
  group by customer_id
),
suspicious_rollup as (
  select customer_id, total_amount,
         row_number() over (order by total_amount desc, customer_id) as rollup_rank
  from customer_rollup
),
unused_debug_cte as (
  select customer_id
  from customer_rollup
  where total_amount > 0
)
select customer_id, total_amount
from suspicious_rollup
where rollup_rank <= :top_n
`;

export const SQL_DEBUG_RECOVERY_PATCH = `suspicious_rollup as (
  select customer_id, total_amount,
         dense_rank() over (order by total_amount desc) as rollup_rank
  from customer_rollup
)
`;

export const SQL_DEBUG_RECOVERY_PARAMS = {
  region_id: 9,
  top_n: 5,
};
