select
  u.user_account_id,
  u.username,
  u.email,
  u.display_name,
  u.created_at,
  u.updated_at,
  p.profile_id,
  p.user_account_id as profile_user_account_id,
  p.bio,
  p.website,
  p.verified
from public.user_account u
left join public.user_profile p on p.user_account_id = u.user_account_id
order by u.user_account_id, p.profile_id;
