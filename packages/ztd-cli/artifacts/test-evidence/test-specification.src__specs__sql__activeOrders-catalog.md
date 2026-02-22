# activeOrders.catalog.ts

- index: [Unit Test Index](./test-specification.index.md)

- schemaVersion: 1
- catalogs: 1

## sql.active-orders - Active orders SQL semantics
- definition: [src/specs/sql/activeOrders.catalog.ts](../../src/specs/sql/activeOrders.catalog.ts)
- tests: 2
- fixtures: orders, users

### baseline - active users with minimum total
#### input
```json
{
  "active": 1,
  "limit": 2,
  "minTotal": 20
}
```
#### output
```json
[
  {
    "orderId": 10,
    "userEmail": "alice@example.com",
    "orderTotal": 50
  },
  {
    "orderId": 13,
    "userEmail": "carol@example.com",
    "orderTotal": 35
  }
]
```

### inactive-variant - inactive users return a different result
#### input
```json
{
  "active": 0,
  "limit": 2,
  "minTotal": 20
}
```
#### output
```json
[
  {
    "orderId": 12,
    "userEmail": "bob@example.com",
    "orderTotal": 40
  }
]
```
