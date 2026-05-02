select
  id,
  company_name as "companyName",
  contact_name as "contactName",
  contact_title as "contactTitle",
  address,
  city,
  region,
  postal_code as "postalCode",
  country,
  phone
from suppliers
order by id asc
limit $1
offset $2
