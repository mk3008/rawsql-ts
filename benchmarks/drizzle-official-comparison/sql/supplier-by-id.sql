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
where id = $1
limit 1
