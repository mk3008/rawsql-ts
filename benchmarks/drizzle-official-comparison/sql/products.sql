select
  id,
  name,
  quantity_per_unit as "quantityPerUnit",
  unit_price as "unitPrice",
  units_in_stock as "unitsInStock",
  units_on_order as "unitsOnOrder",
  reorder_level as "reorderLevel",
  discontinued,
  supplier_id as "supplierId"
from products
order by id asc
limit $1
offset $2
