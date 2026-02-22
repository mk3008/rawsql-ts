<!-- generated-by: @rawsql-ts/ddl-docs-cli -->

# master.product

[<- All Schemas](../index.md) | [Table Index](./index.md)

## Overview

- Comment: product master
- Source Files: `packages/ddl-docs-cli/examples/minimal-e2e/ddl/master.sql`

## Columns

| Key | Column | Type | Nullable | Default | Comment | Usages |
| --- | --- | --- | --- | --- | --- | --- |
| PK | `product_id` | `bigserial` | NO | - | - | [See usages](./columns/product-id.md) |
|  | `product_code` | `text` | NO | - | business product code | [See usages](./columns/product-code.md) |
|  | `product_name` | `text` | NO | - | - | [See usages](./columns/product-name.md) |
|  | `unit_price` | `int` | NO | - | - | [See usages](./columns/unit-price.md) |

## Constraints

| Kind | Name | Expression |
| --- | --- | --- |
| UK | - | product_code |

## References

### DDL

- None

### Suggest

| From | To | Columns | Match | On Delete | On Update |
| --- | --- | --- | --- | --- | --- |
| [public.order_item](../public/order-item.md) | `master.product` | `product_id -> product_id` | `exact` | `none` | `none` |

## Appendix

### Normalized SQL

```sql
-- normalized: v1 dialect=postgres
create table "master"."product"(
  "product_id" bigserial not null,
  "product_code" text not null,
  "product_name" text not null,
  "unit_price" int not null
);
alter table "master"."product"
  add primary key("product_id");
alter table "master"."product"
  add unique("product_code");
comment on table "master"."product" is 'product master';
comment on column "master"."product"."product_code" is 'business product code';
```
