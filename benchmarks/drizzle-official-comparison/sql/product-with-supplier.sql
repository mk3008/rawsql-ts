select
  p.id,
  p.name,
  p.quantity_per_unit as "quantityPerUnit",
  p.unit_price as "unitPrice",
  p.units_in_stock as "unitsInStock",
  p.units_on_order as "unitsOnOrder",
  p.reorder_level as "reorderLevel",
  p.discontinued,
  p.supplier_id as "supplierId",
  s.id as "supplier_id",
  s.company_name as "supplier_companyName",
  s.contact_name as "supplier_contactName",
  s.contact_title as "supplier_contactTitle",
  s.address as "supplier_address",
  s.city as "supplier_city",
  s.region as "supplier_region",
  s.postal_code as "supplier_postalCode",
  s.country as "supplier_country",
  s.phone as "supplier_phone"
from products p
inner join suppliers s on s.id = p.supplier_id
where p.id = $1
