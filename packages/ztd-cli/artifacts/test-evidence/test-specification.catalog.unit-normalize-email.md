# unit.normalize-email Test Cases

- schemaVersion: 1
- index: [Unit Test Index](./test-specification.index.md)
- title: normalizeEmail
- definition: [tests/specs/testCaseCatalogs.ts](../../tests/specs/testCaseCatalogs.ts)
- description: Executable, inference-free specification for internal normalization behavior.
- refs:
  - [Issue #448](https://github.com/mk3008/rawsql-ts/issues/448)
- tests: 6

## accepts-minimal-domain - accepts shortest practical domain form
- expected: success
- tags: [validation, bva]
- focus: Ensures minimal local and domain segments are accepted.
### input
```json
"a@b.c"
```
### output
```json
"a@b.c"
```

## keeps-plus-alias - preserves plus alias while normalizing case
- expected: success
- tags: [normalization, bva]
- focus: Ensures alias characters are preserved during normalization.
### input
```json
" USER+tag@Example.COM "
```
### output
```json
"user+tag@example.com"
```

## keeps-valid-address - retains already-normalized email
- expected: success
- tags: [normalization, idempotence]
- focus: Ensures already normalized input remains unchanged.
### input
```json
"alice@example.com"
```
### output
```json
"alice@example.com"
```

## rejects-invalid-input - throws when @ is missing
- expected: throws
- tags: [validation, ep]
- focus: Rejects input without @ before producing normalized output.
- refs:
  - [Issue #777](https://github.com/mk3008/rawsql-ts/issues/777)
### input
```json
"invalid-email"
```
### error
```json
{
  "name": "Error",
  "message": "invalid email",
  "match": "contains"
}
```

## throws-empty-after-trim - throws when trimmed input is empty
- expected: throws
- tags: [validation, bva]
- focus: Rejects whitespace-only input after trimming.
### input
```json
"   "
```
### error
```json
{
  "name": "Error",
  "message": "invalid email",
  "match": "contains"
}
```

## trims-and-lowercases - normalizes uppercase + spaces
- expected: success
- tags: [normalization, ep]
- focus: Ensures trimming and lowercasing run before return.
### input
```json
"  USER@Example.COM "
```
### output
```json
"user@example.com"
```


