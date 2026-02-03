
CREATE TABLE public.user_account (
  user_account_id bigserial PRIMARY KEY,
  username text NOT NULL,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_profile (
  profile_id bigserial PRIMARY KEY,
  user_account_id bigint NOT NULL REFERENCES public.user_account(user_account_id),
  bio text,
  website text,
  verified boolean NOT NULL DEFAULT false
);
