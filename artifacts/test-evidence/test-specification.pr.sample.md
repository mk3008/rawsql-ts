# Test Evidence (PR Diff)

- base: sample-base (1111111)
- head: sample-head (2222222)
- base-mode: ref
- tests: +3 / ~1 / -2
- base totals: tests=4
- head totals: tests=5

## sql.added-catalog - Added SQL Catalog

[File](../../packages/ztd-cli/src/specs/sql/added.catalog.ts)

### ADD: new - new

**after**

input
```json
{}
```
output
```json
[
  {
    "id": 200
  }
]
```

## sql.removed-catalog - Removed SQL Catalog

[File](../../packages/ztd-cli/src/specs/sql/removed.catalog.ts)

### REMOVE: gone - gone

**before**

input
```json
{}
```
output
```json
[
  {
    "id": 100
  }
]
```

## sql.users - Users SQL

[File](../../packages/ztd-cli/src/specs/sql/users.catalog.ts)

### ADD: added-case - newly added

**after**

input
```json
{
  "active": 2
}
```
output
```json
[
  {
    "id": 3
  }
]
```

### UPDATE: baseline - returns active users

**before**

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

### REMOVE: removed-case - will be removed

**before**

input
```json
{
  "active": 9
}
```
output
```json
[
  {
    "id": 9
  }
]
```

## unit.normalize - normalize

[File](../../packages/ztd-cli/tests/specs/testCaseCatalogs.ts)

### ADD: fn-added - function case added

**after**

input
```json
"B"
```
output
```json
"b"
```

