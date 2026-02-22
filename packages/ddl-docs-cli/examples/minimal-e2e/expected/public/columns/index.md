<!-- generated-by: @rawsql-ts/ddl-docs-cli -->

# Column Index

[<- Schema Tables](../index.md)

| Concept | Usages | Type Keys | Comment | Alert |
| --- | --- | --- | --- | --- |
| [age](./age.md) | 1 | int4 | - |  |
| [created_at](./created-at.md) | 2 | timestamptz | - |  |
| [email](./email.md) | 1 | raw:text | login mail address | ALERT |
| [order_id](./order-id.md) | 3 | int8, int8{serial} | order identifier | ALERT |
| [order_item_id](./order-item-id.md) | 1 | int8{serial} | - |  |
| [product_code](./product-code.md) | 1 | raw:text | - | ALERT |
| [product_id](./product-id.md) | 2 | int8 | - |  |
| [quantity](./quantity.md) | 1 | int4 | - |  |
| [snapshot_note](./snapshot-note.md) | 1 | raw:text | - | ALERT |
| [total_amount](./total-amount.md) | 1 | numeric | - |  |
| [unit_price](./unit-price.md) | 1 | numeric | - | ALERT |
| [user_id](./user-id.md) | 2 | int8, int8{serial} | - |  |
