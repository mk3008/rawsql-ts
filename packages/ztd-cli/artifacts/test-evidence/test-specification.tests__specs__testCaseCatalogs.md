# testCaseCatalogs.ts

- index: [Unit Test Index](./test-specification.index.md)

- schemaVersion: 1
- catalogs: 2

## unit.alpha - alpha
- definition: [tests/specs/testCaseCatalogs.ts](../../tests/specs/testCaseCatalogs.ts)
- tests: 1

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
- definition: [tests/specs/testCaseCatalogs.ts](../../tests/specs/testCaseCatalogs.ts)
- description: Executable, inference-free specification for internal normalization behavior.
- tests: 3

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
