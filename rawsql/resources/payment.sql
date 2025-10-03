select customer_id, sum(amount) as total
from payments
group by customer_id;