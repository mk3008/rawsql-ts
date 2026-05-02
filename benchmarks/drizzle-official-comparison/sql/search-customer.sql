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
where to_tsvector('english', company_name) @@ to_tsquery('english', $1)
