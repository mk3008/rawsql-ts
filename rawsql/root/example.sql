with
    cte1 as (select id , name from customers),
    payment as (select customer_id , sum(amount) as total from payments group by customer_id)
select
    c.id
    , c.name
    , p.total
from
    cte1 as c
    join payment as p on p.customer_id = c.id
order by
    c.id
