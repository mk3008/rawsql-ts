---
title: rowMapping, coercions and validators — pipeline order
---

# rowMapping, coercions and validators

This page explains how data transforms flow through `@rawsql-ts/sql-contract` and the ZTD runtime so you can avoid conflicts.

## Pipeline order

```
SQL driver row
  │
  ▼
rowMapping          Renames columns (snake_case → camelCase, custom columnMap)
  │
  ▼
Runtime coercion    Normalizes driver-dependent types (e.g., timestampFromDriver)
  │
  ▼
Validator           Validates / parses the final DTO shape (Zod, ArkType, etc.)
```

Each stage receives the **output** of the previous stage, not the raw SQL row. This means:

- `rowMapping` sees the raw column names from the driver.
- Runtime coercions see the **mapped** property names.
- The validator sees the **coerced, mapped** DTO.

## Recommendations

### Do: coerce before validation

Apply driver-dependent normalization (timestamps, numeric strings) **before** the validator runs. The ZTD template does this in `src/catalog/runtime/`:

```ts
// _coercions.ts
export { timestampFromDriver as normalizeTimestamp } from '@rawsql-ts/sql-contract';

// _smoke.runtime.ts
export function ensureSmokeOutput(value: unknown): SmokeOutput {
  if (isRecord(value) && 'createdAt' in value) {
    return parseSmokeOutput({
      ...value,
      createdAt: normalizeTimestamp(value.createdAt, 'createdAt')
    });
  }
  return parseSmokeOutput(value);
}
```

### Don't: let the validator coerce types that the driver already handles

If you use Zod's `z.coerce.date()` alongside `normalizeTimestamp`, the timestamp is parsed twice — once by the coercion helper, once by Zod. This can produce subtle bugs when one parser rejects a format that the other accepts.

```ts
// BAD: double coercion
const Schema = z.object({
  createdAt: z.coerce.date()   // Zod tries to parse the string
});
// ... and the runtime also calls normalizeTimestamp(value.createdAt)

// GOOD: let the runtime coerce, validator only asserts
const Schema = z.object({
  createdAt: z.date()          // Zod expects a Date object (already coerced)
});
```

### Do: keep rowMapping output names consistent with the validator schema

The validator schema field names must match the **mapped** names, not the raw SQL column names:

```ts
// rowMapping produces { userId, displayName }
const mapping = rowMapping({
  name: 'User',
  key: 'userId',
  columnMap: { userId: 'user_id', displayName: 'display_name' }
});

// Validator schema uses mapped names
const UserSchema = z.object({
  userId: z.number(),
  displayName: z.string()
});
```

### Don't: add validator transforms that conflict with rowMapping

If `rowMapping` renames `user_id` → `userId`, do not add a Zod `.transform()` that also tries to rename or reshape the same field. Let each stage own its responsibility:

| Stage | Responsibility |
|-------|---------------|
| `rowMapping` | Column renaming, key definition |
| Runtime coercion | Driver-dependent type normalization |
| Validator | Shape assertion and strict type checking |

## Summary

| Pattern | Recommendation |
|---------|---------------|
| Timestamp normalization | Use `normalizeTimestamp` in runtime, use `z.date()` (not `z.coerce.date()`) in validator |
| Column renaming | Use `rowMapping.columnMap`, not validator `.transform()` |
| Numeric coercion | Use runtime coercion for driver quirks, validator for shape assertion |
| Chainable validators | `.validator(v1).validator(v2)` — each runs in sequence on the same DTO |
