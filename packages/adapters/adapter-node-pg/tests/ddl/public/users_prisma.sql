CREATE TABLE public.users_prisma (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  active bool NOT NULL DEFAULT true
);
