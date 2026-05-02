select
  id,
  last_name as "lastName",
  first_name as "firstName",
  title,
  title_of_courtesy as "titleOfCourtesy",
  to_char(birth_date, 'YYYY-MM-DD"T"00:00:00"Z"') as "birthDate",
  to_char(hire_date, 'YYYY-MM-DD"T"00:00:00"Z"') as "hireDate",
  address,
  city,
  postal_code as "postalCode",
  country,
  home_phone as "homePhone",
  extension,
  notes,
  recipient_id as "recipientId"
from employees
order by id asc
limit $1
offset $2
