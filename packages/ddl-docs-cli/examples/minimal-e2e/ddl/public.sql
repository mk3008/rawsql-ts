CREATE TABLE public.user (
  user_id bigserial PRIMARY KEY,
  email text NOT NULL,
  age int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.order (
  order_id bigserial PRIMARY KEY,
  user_id bigint NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()--,
  --CONSTRAINT order_user_fk FOREIGN KEY (user_id) REFERENCES public.user(user_id)
);

CREATE TABLE public.order_item (
  order_item_id bigserial PRIMARY KEY,
  order_id bigint NOT NULL,
  product_id bigint NOT NULL,
  product_code text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  CONSTRAINT order_item_order_fk FOREIGN KEY (order_id) REFERENCES public.order(order_id) ON DELETE CASCADE
  --,
  --CONSTRAINT order_item_product_fk FOREIGN KEY (product_id) REFERENCES master.product(product_id)
);

CREATE TABLE public.order_item_snapshot (
  order_id bigint NOT NULL,
  product_id bigint NOT NULL,
  snapshot_note text,
  CONSTRAINT order_item_snapshot_pk PRIMARY KEY (order_id, product_id),
  CONSTRAINT order_item_snapshot_item_fk FOREIGN KEY (order_id, product_id) REFERENCES public.order_item(order_id, product_id)
);

ALTER TABLE public.user ADD CONSTRAINT user_age_chk CHECK (age > 0);
ALTER TABLE public.order ADD CONSTRAINT order_total_chk CHECK (total_amount >= 0);
ALTER TABLE public.order_item ADD CONSTRAINT order_item_qty_chk CHECK (quantity > 0);
ALTER TABLE public.order_item ADD CONSTRAINT order_item_order_product_uk UNIQUE (order_id, product_id);

COMMENT ON TABLE public.user IS 'application user';
COMMENT ON COLUMN public.user.email IS 'login mail address';
COMMENT ON TABLE public.order IS 'purchase order';
