# usersList.catalog.ts

- index: [Unit Test Index](./test-specification.index.md)

- schemaVersion: 1
- catalogs: 1

## sql.sample - sample sql cases
- definition: [src/specs/sql/usersList.catalog.ts](../../src/specs/sql/usersList.catalog.ts)
- tests: 2
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
