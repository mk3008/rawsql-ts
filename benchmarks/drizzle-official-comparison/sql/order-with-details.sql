select
  o.id,
  to_char(o.shipped_date, 'YYYY-MM-DD"T"00:00:00"Z"') as "shippedDate",
  o.ship_name as "shipName",
  o.ship_city as "shipCity",
  o.ship_country as "shipCountry",
  count(d.product_id)::int as "productsCount",
  coalesce(sum(d.quantity), 0)::int as "quantitySum",
  coalesce(sum(d.quantity * d.unit_price), 0)::real as "totalPrice"
from orders o
left join order_details d on d.order_id = o.id
where o.id = $1
group by o.id
order by o.id asc
