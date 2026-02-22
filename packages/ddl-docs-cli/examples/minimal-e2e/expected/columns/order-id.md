<!-- generated-by: @rawsql-ts/ddl-docs-cli -->

# Global Column Concept (Alerts): order_id

[<- Alert Index](./index.md)

- View: Global alert concept page

## Type Distribution

| Type Key | Count | Comment |
| --- | --- | --- |
| `int8` | 2 | order identifier |
| `int8{serial}` | 1 | - |

## Usages

| Location | Type Key | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| [public.order_item_snapshot.order_id](../public/order-item-snapshot.md) | `int8` | NO | - | NO |
| [public.order_item.order_id](../public/order-item.md) | `int8` | NO | - | YES |
| [public.order.order_id](../public/order.md) | `int8{serial}` | NO | - | NO |

## Findings

- [MISSING_COMMENT_SUGGESTED] Missing comment for public.order_item_snapshot.order_id.
- [MISSING_COMMENT_SUGGESTED] Missing comment for public.order.order_id.
