CREATE TABLE master.product (
  product_id bigserial PRIMARY KEY,
  product_code text NOT NULL UNIQUE,
  product_name text NOT NULL,
  unit_price int NOT NULL
);

COMMENT ON TABLE master.product IS 'product master';
COMMENT ON COLUMN master.product.product_code IS 'business product code';
