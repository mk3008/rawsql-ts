<!-- generated-by: @rawsql-ts/ddl-docs-cli -->

# public.user

[<- All Schemas](../index.md) | [Table Index](./index.md)

## Overview

- Comment: application user
- Source Files: `packages/ddl-docs-cli/examples/minimal-e2e/ddl/public.sql`

## Columns

| Key | Column | Type | Nullable | Default | Comment | Usages |
| --- | --- | --- | --- | --- | --- | --- |
| PK | `user_id` | `bigserial` | NO | - | - | [See usages](./columns/user-id.md) |
|  | `email` | `text` | NO | - | login mail address | [See usages](./columns/email.md) |
|  | `age` | `int` | YES | - | - | [See usages](./columns/age.md) |
|  | `created_at` | `timestamptz` | YES | `now()` | - | [See usages](./columns/created-at.md) |

## Constraints

| Kind | Name | Expression |
| --- | --- | --- |
| CHECK | `user_age_chk` | "age" > 0 |

## References

### DDL

- None

### Suggest

| From | To | Columns | Match |
| --- | --- | --- | --- |
| [public.order](./order.md) | `public.user` | `user_id -> user_id` | `exact` |

## Appendix

### Normalized SQL

```sql
-- normalized: v1 dialect=postgres
create table "public"."user"(
  "user_id" bigserial not null,
  "email" text not null,
  "age" int,
  "created_at" timestamptz default now()
);
alter table "public"."user"
  add constraint "user_age_chk" check("age" > 0);
alter table "public"."user"
  add primary key("user_id");
comment on table "public"."user" is 'application user';
comment on column "public"."user"."email" is 'login mail address';
```
