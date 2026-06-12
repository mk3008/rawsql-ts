select
  id,
  company_name as "companyName",
  contact_name as "contactName",
  contact_title as "contactTitle",
  address,
  city,
  postal_code as "postalCode",
  region,
  country,
  phone,
  fax
from customers
where id = $1
limit 1
