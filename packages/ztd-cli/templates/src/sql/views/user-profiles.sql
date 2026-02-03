SELECT
  u.user_account_id,
  u.username,
  u.email,
  u.display_name,
  u.created_at,
  u.updated_at,
  p.profile_id,
  p.user_account_id AS profile_user_account_id,
  p.bio,
  p.website,
  p.verified
FROM public.user_account u
LEFT JOIN public.user_profile p ON p.user_account_id = u.user_account_id
ORDER BY u.user_account_id, p.profile_id;
