<!-- generated-by: @rawsql-ts/ddl-docs-cli -->

# Global Column Concept (Alerts): unit_price

[<- Alert Index](./index.md)

- View: Global alert concept page

## Type Distribution

| Type Key | Count | Comment |
| --- | --- | --- |
| `int4` | 1 | - |
| `numeric` | 1 | - |

## Usages

| Location | Type Key | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| [master.product.unit_price](../master/product.md) | `int4` | NO | - | NO |
| [public.order_item.unit_price](../public/order-item.md) | `numeric` | NO | - | NO |

## Findings

- [COLUMN_NAME_TYPE_DIVERGENCE] Type variation detected for concept "unit_price".
