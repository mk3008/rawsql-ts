CREATE TABLE public.customers (
  id integer PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.orders (
  id integer PRIMARY KEY,
  number text NOT NULL,
  customer_id integer NOT NULL REFERENCES public.customers(id)
);

CREATE TABLE public.invoice (
  invoice_id integer PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES public.customers(id),
  issued_at timestamptz NOT NULL
);
