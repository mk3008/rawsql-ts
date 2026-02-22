<!-- generated-by: @rawsql-ts/ddl-docs-cli -->

# public.order_item_snapshot

[<- All Schemas](../index.md) | [Table Index](./index.md)

## Overview

- Comment: -
- Source Files: `packages/ddl-docs-cli/examples/minimal-e2e/ddl/public.sql`

## Columns

| Key | Column | Type | Nullable | Default | Comment | Usages |
| --- | --- | --- | --- | --- | --- | --- |
| PK | `order_id` | `bigint` | NO | - | - | [See usages](./columns/order-id.md) |
| PK | `product_id` | `bigint` | NO | - | - | [See usages](./columns/product-id.md) |
|  | `snapshot_note` | `text` | YES | - | - | [See usages](./columns/snapshot-note.md) |

## Constraints

- None

## References

### DDL

| From | To | Columns | On Delete | On Update |
| --- | --- | --- | --- | --- |
| `public.order_item_snapshot` | [public.order_item](./order-item.md) | `order_id, product_id -> order_id, product_id` | `none` | `none` |

### Suggest

- None

## Appendix

### Normalized SQL

```sql
-- normalized: v1 dialect=postgres
create table "public"."order_item_snapshot"(
  "order_id" bigint not null,
  "product_id" bigint not null,
  "snapshot_note" text
);
alter table "public"."order_item_snapshot"
  add constraint "order_item_snapshot_item_fk" foreign key("order_id",
  "product_id") references "public"."order_item"("order_id",
  "product_id");
alter table "public"."order_item_snapshot"
  add constraint "order_item_snapshot_pk" primary key("order_id",
  "product_id");
```

### Suggested Column Comment SQL (Optional)

```sql
-- suggested: v1 (not applied)
COMMENT ON COLUMN "public"."order_item_snapshot"."order_id" IS 'order identifier';
```
