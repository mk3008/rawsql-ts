---
"@rawsql-ts/sql-contract": minor
"@rawsql-ts/ztd-cli": patch
---

Add a new public `timestampFromDriver(value, fieldName?)` helper in `@rawsql-ts/sql-contract` for fail-fast `Date | string` normalization of driver-returned timestamps.

Update `@rawsql-ts/ztd-cli` templates to normalize runtime timestamp fields through the shared sql-contract helper (via runtime coercion wiring), add strict guardrails against local timestamp re-implementation, and expand scaffold smoke validation tests for valid and invalid timestamp strings.
