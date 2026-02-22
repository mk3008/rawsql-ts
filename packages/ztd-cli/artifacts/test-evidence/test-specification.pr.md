# Test Evidence (PR Diff)

- base: merge-base(main, HEAD) (c8f60f4406390ad953dbf97829de88ab55e7cc40)
- head: HEAD (fd7e3e96429d3c1a068306458c0d1d1ea8c60067)
- base-mode: merge-base
- tests: +8 / ~0 / -0
- base totals: tests=0
- head totals: tests=8

## sql.active-orders - Active orders SQL semantics

[File](../../src/specs/sql/activeOrders.catalog.ts)

### ADD: baseline - active users with minimum total

**after**

input
```json
{
  "active": 1,
  "limit": 2,
  "minTotal": 20
}
```
output
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

### ADD: inactive-variant - inactive users return a different result

**after**

input
```json
{
  "active": 0,
  "limit": 2,
  "minTotal": 20
}
```
output
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

[File](../../src/specs/sql/usersList.catalog.ts)

### ADD: returns-active-users - returns active users

**after**

input
```json
{
  "active": 1
}
```
output
```json
[
  {
    "id": 1
  }
]
```

### ADD: returns-inactive-users-when-active-0 - returns inactive users when active=0

**after**

input
```json
{
  "active": 0
}
```
output
```json
[
  {
    "id": 2
  }
]
```

## unit.alpha - alpha

[File](../../tests/specs/testCaseCatalogs.ts)

### ADD: a - noop

**after**

input
```json
1
```
output
```json
1
```

## unit.normalize-email - normalizeEmail

[File](../../tests/specs/testCaseCatalogs.ts)

### ADD: keeps-valid-address - retains already-normalized email

**after**

input
```json
"alice@example.com"
```
output
```json
"alice@example.com"
```

### ADD: rejects-invalid-input - throws when @ is missing

**after**

input
```json
"invalid-email"
```
output
```json
"Error: invalid email"
```

### ADD: trims-and-lowercases - normalizes uppercase + spaces

**after**

input
```json
"  USER@Example.COM "
```
output
```json
"user@example.com"
```

