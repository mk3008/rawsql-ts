# Test Evidence Specification

- schemaVersion: 1
- catalogs: 4
- sqlCatalogs: 2
- functionCatalogs: 2
- tests: 8

## sql.active-orders - Active orders SQL semantics
- kind: sql
- definition: [src/specs/sql/activeOrders.catalog.ts](../../src/specs/sql/activeOrders.catalog.ts)
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

## sql.sample - sample sql cases
- kind: sql
- definition: [src/specs/sql/usersList.catalog.ts](../../src/specs/sql/usersList.catalog.ts)
- fixtures: users

### returns-active-users - returns active users
#### input
```json
{
  "active": 1
}
```
#### output
```json
[
  {
    "id": 1
  }
]
```

### returns-inactive-users-when-active-0 - returns inactive users when active=0
#### input
```json
{
  "active": 0
}
```
#### output
```json
[
  {
    "id": 2
  }
]
```

## unit.alpha - alpha
- kind: function
- definition: [tests/specs/testCaseCatalogs.ts](../../tests/specs/testCaseCatalogs.ts)

### a - noop
#### input
```json
1
```
#### output
```json
1
```

## unit.normalize-email - normalizeEmail
- kind: function
- definition: [tests/specs/testCaseCatalogs.ts](../../tests/specs/testCaseCatalogs.ts)

### keeps-valid-address - retains already-normalized email
#### input
```json
"alice@example.com"
```
#### output
```json
"alice@example.com"
```

### rejects-invalid-input - throws when @ is missing
#### input
```json
"invalid-email"
```
#### output
```json
"Error: invalid email"
```

### trims-and-lowercases - normalizes uppercase + spaces
#### input
```json
"  USER@Example.COM "
```
#### output
```json
"user@example.com"
```

