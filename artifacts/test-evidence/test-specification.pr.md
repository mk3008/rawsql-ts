# Test Evidence (PR Diff)

- base: merge-base(main, HEAD) (c8f60f4406390ad953dbf97829de88ab55e7cc40)
- head: HEAD (fd7e3e96429d3c1a068306458c0d1d1ea8c60067)
- base-mode: merge-base
- catalogs: +4 / -0 / ~0
- tests: +8 / -0 / ~0
- base totals: catalogs=0 tests=0
- head totals: catalogs=4 tests=8

## Added
## sql.active-orders — Active orders SQL semantics
- definition: `src/specs/sql/activeOrders.catalog.ts`
- fixtures:
  - orders
  - users

### baseline — active users with minimum total
input:
```json
{
  "active": 1,
  "limit": 2,
  "minTotal": 20
}
```
output:
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

---

### inactive-variant — inactive users return a different result
input:
```json
{
  "active": 0,
  "limit": 2,
  "minTotal": 20
}
```
output:
```json
[
  {
    "orderId": 12,
    "userEmail": "bob@example.com",
    "orderTotal": 40
  }
]
```

## sql.sample — sample sql cases
- definition: `src/specs/sql/usersList.catalog.ts`
- fixtures:
  - users

### returns-active-users — returns active users
input:
```json
{
  "active": 1
}
```
output:
```json
[
  {
    "id": 1
  }
]
```

---

### returns-inactive-users-when-active-0 — returns inactive users when active=0
input:
```json
{
  "active": 0
}
```
output:
```json
[
  {
    "id": 2
  }
]
```

## unit.alpha — alpha

### a — noop
input:
```json
1
```
output:
```json
1
```

## unit.normalize-email — normalizeEmail

### keeps-valid-address — retains already-normalized email
input:
```json
"alice@example.com"
```
output:
```json
"alice@example.com"
```

---

### rejects-invalid-input — throws when @ is missing
input:
```json
"invalid-email"
```
output:
```json
"Error: invalid email"
```

---

### trims-and-lowercases — normalizes uppercase + spaces
input:
```json
"  USER@Example.COM "
```
output:
```json
"user@example.com"
```

## Removed
- (none)

## Updated
- (none)

