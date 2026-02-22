# sql.active-orders

- index: [Unit Test Index](./test-specification.index.md)
- title: Active orders SQL semantics
- definition: [src/specs/sql/activeOrders.catalog.ts](../../src/specs/sql/activeOrders.catalog.ts)
- tests: 2
- fixtures: orders, users

## Test Cases

### baseline - active users with minimum total
- expected: success
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
    "orderTotal": 50,
    "userEmail": "alice@example.com"
  },
  {
    "orderId": 13,
    "orderTotal": 35,
    "userEmail": "carol@example.com"
  }
]
```

### inactive-variant - inactive users return a different result
- expected: success
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
    "orderTotal": 40,
    "userEmail": "bob@example.com"
  }
]
```


