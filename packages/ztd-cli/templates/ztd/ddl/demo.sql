CREATE TABLE public.example_item (
  id bigserial PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
