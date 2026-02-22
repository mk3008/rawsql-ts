<!-- generated-by: @rawsql-ts/ddl-docs-cli -->

# Global Column Concept (Alerts): product_code

[<- Alert Index](./index.md)

- View: Global alert concept page

## Type Distribution

| Type Key | Count | Comment |
| --- | --- | --- |
| `raw:text` | 2 | business product code |

## Usages

| Location | Type Key | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| [master.product.product_code](../master/product.md) | `raw:text` | NO | - | YES |
| [public.order_item.product_code](../public/order-item.md) | `raw:text` | NO | - | NO |

## Findings

- [UNSUPPORTED_OR_UNKNOWN_TYPE] Unknown type treated as raw for master.product.product_code: text
- [UNSUPPORTED_OR_UNKNOWN_TYPE] Unknown type treated as raw for public.order_item.product_code: text
