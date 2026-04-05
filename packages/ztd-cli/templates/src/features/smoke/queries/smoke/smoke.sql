select
  user_id,
  email
from users
where user_id = :user_id::integer;
