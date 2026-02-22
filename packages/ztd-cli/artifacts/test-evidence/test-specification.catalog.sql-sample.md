# sql.sample

- index: [Unit Test Index](./test-specification.index.md)
- title: sample sql cases
- definition: [src/specs/sql/usersList.catalog.ts](../../src/specs/sql/usersList.catalog.ts)
- tests: 2
- fixtures: users

## Test Cases

### returns-active-users - returns active users
- expected: success
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
- expected: success
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


