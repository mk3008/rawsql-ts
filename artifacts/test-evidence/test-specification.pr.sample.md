# Test Evidence (PR Diff)

- base: sample-base (1111111)
- head: sample-head (2222222)
- base-mode: ref
- catalogs: +1 / -1 / ~2
- tests: +3 / -2 / ~1
- base totals: catalogs=3 tests=4
- head totals: catalogs=3 tests=5

## Added catalogs

## sql.added-catalog — Added SQL Catalog
- definition: `src/specs/sql/added.catalog.ts`
- fixtures:
  - added

### new — new
input:
```json
{}
```
output:
```json
[
  {
    "id": 200
  }
]
```

## Removed catalogs

## sql.removed-catalog — Removed SQL Catalog
- definition: `src/specs/sql/removed.catalog.ts`
- fixtures:
  - removed

### gone — gone
input:
```json
{}
```

## Updated catalogs

## sql.users — Users SQL
- definition: `src/specs/sql/users.catalog.ts`
- fixtures:
  - users

Added cases

### added-case — newly added
input:
```json
{
  "active": 2
}
```
output:
```json
[
  {
    "id": 3
  }
]
```

Removed cases

### removed-case — will be removed
input:
```json
{
  "active": 9
}
```

Updated cases

### baseline — returns active users
input (before):
```json
{
  "active": 1
}
```
input (after):
```json
{
  "active": 0
}
```
output (before):
```json
[
  {
    "id": 1
  }
]
```
output (after):
```json
[
  {
    "id": 2
  }
]
```

## unit.normalize — normalize

Added cases

### fn-added — function case added
input:
```json
"B"
```
output:
```json
"b"
```

