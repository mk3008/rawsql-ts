<!-- generated-by: @rawsql-ts/ddl-docs-cli -->

# public.order

[<- All Schemas](../index.md) | [Table Index](./index.md)

## Overview

- Comment: purchase order
- Source Files: `packages/ddl-docs-cli/examples/minimal-e2e/ddl/public.sql`

## Columns

| Key | Column | Type | Nullable | Default | Comment | Usages |
| --- | --- | --- | --- | --- | --- | --- |
| PK | `order_id` | `bigserial` | NO | - | - | [See usages](./columns/order-id.md) |
|  | `user_id` | `bigint` | NO | - | - | [See usages](./columns/user-id.md) |
|  | `total_amount` | `numeric` | NO | - | - | [See usages](./columns/total-amount.md) |
|  | `created_at` | `timestamptz` | YES | `now()` | - | [See usages](./columns/created-at.md) |

## Constraints

| Kind | Name | Expression |
| --- | --- | --- |
| CHECK | `order_total_chk` | "total_amount" >= 0 |

## References

### DDL

| From | To | Columns | Match | On Delete | On Update |
| --- | --- | --- | --- | --- | --- |
| [public.order_item](./order-item.md) | `public.order` | `order_id -> order_id` | - | `cascade` | `none` |

### Suggest

| From | To | Columns | Match | On Delete | On Update |
| --- | --- | --- | --- | --- | --- |
| `public.order` | [public.user](./user.md) | `user_id -> user_id` | `exact` | `none` | `none` |

## Appendix

### Normalized SQL

```sql
-- normalized: v1 dialect=postgres
create table "public"."order"(
  "order_id" bigserial not null,
  "user_id" bigint not null,
  "total_amount" numeric not null,
  "created_at" timestamptz default now()
);
alter table "public"."order"
  add constraint "order_total_chk" check("total_amount" >= 0);
alter table "public"."order"
  add primary key("order_id");
comment on table "public"."order" is 'purchase order';
```

### Suggested SQL (Optional)

```sql
-- suggested: v1 (not applied)
ALTER TABLE "public"."order" ADD FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id");
```
