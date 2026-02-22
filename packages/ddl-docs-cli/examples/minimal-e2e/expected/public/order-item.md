<!-- generated-by: @rawsql-ts/ddl-docs-cli -->

# public.order_item

[<- All Schemas](../index.md) | [Table Index](./index.md)

## Overview

- Comment: -
- Source Files: `packages/ddl-docs-cli/examples/minimal-e2e/ddl/public.sql`

## Columns

| Key | Column | Type | Nullable | Default | Comment | Usages |
| --- | --- | --- | --- | --- | --- | --- |
| PK | `order_item_id` | `bigserial` | NO | - | - | [See usages](./columns/order-item-id.md) |
|  | `order_id` | `bigint` | NO | - | order identifier | [See usages](./columns/order-id.md) |
|  | `product_id` | `bigint` | NO | - | - | [See usages](./columns/product-id.md) |
|  | `product_code` | `text` | NO | - | - | [See usages](./columns/product-code.md) |
|  | `quantity` | `int` | NO | `1` | - | [See usages](./columns/quantity.md) |
|  | `unit_price` | `numeric` | NO | - | - | [See usages](./columns/unit-price.md) |

## Constraints

| Kind | Name | Expression |
| --- | --- | --- |
| CHECK | `order_item_qty_chk` | "quantity" > 0 |
| UK | `order_item_order_product_uk` | order_id, product_id |

## References

### DDL

| From | To | Columns | On Delete | On Update |
| --- | --- | --- | --- | --- |
| [public.order_item_snapshot](./order-item-snapshot.md) | `public.order_item` | `order_id, product_id -> order_id, product_id` | `none` | `none` |
| `public.order_item` | [public.order](./order.md) | `order_id -> order_id` | `cascade` | `none` |

### Suggest

| From | To | Columns | Match |
| --- | --- | --- | --- |
| `public.order_item` | [master.product](../master/product.md) | `product_id -> product_id` | `exact` |

## Appendix

### Normalized SQL

```sql
-- normalized: v1 dialect=postgres
create table "public"."order_item"(
  "order_item_id" bigserial not null,
  "order_id" bigint not null,
  "product_id" bigint not null,
  "product_code" text not null,
  "quantity" int not null default 1,
  "unit_price" numeric not null
);
alter table "public"."order_item"
  add constraint "order_item_qty_chk" check("quantity" > 0);
alter table "public"."order_item"
  add constraint "order_item_order_fk" foreign key("order_id") references "public"."order"("order_id") on delete cascade;
alter table "public"."order_item"
  add primary key("order_item_id");
alter table "public"."order_item"
  add constraint "order_item_order_product_uk" unique("order_id",
  "product_id");
comment on column "public"."order_item"."order_id" is 'order identifier';
```

### Suggested Column Comment SQL (Optional)

```sql
-- suggested: v1 (not applied)
COMMENT ON COLUMN "public"."order_item"."product_code" IS 'business product code';
```

### Suggested Foreign Key Constraint SQL (Optional)

```sql
-- suggested: v1 (not applied)
ALTER TABLE "public"."order_item" ADD FOREIGN KEY ("product_id") REFERENCES "master"."product"("product_id");
```
