# AGENTS: Mapper Test Guidelines

This document defines **rules and expectations for tests** under `tests/`
that exercise `@rawsql-ts/mapper`.

These rules exist to ensure that tests validate **intentional behavior**
rather than accidental implementation details.

---

## Purpose of Mapper Tests

Mapper tests must verify:

- Deterministic row-to-object mapping
- Explicit relation wiring behavior
- Strict error handling
- DBMS-agnostic assumptions

Mapper tests must NOT:
- Test SQL generation
- Test database connectivity
- Test driver-specific behavior
- Test ORM-like conveniences

Rows are treated as **pure input data**.

---

## Row Construction Rules

Test rows must:

- Be plain objects (`Record<string, unknown>`)
- Use realistic SQL column names
- Avoid relying on JS object key order
- Avoid magical casing assumptions

Bad examples:
- Using camelCase column names unless explicitly testing normalization
- Omitting required columns "because the test knows better"

Good examples:
- Explicit snake_case columns
- Explicit aliases when ambiguity exists

---

## Explicit Mapping Is the Default

Most tests SHOULD use `EntityMapping`.

Duck-typed mapping is allowed only when:
- Explicitly testing duck-typed behavior
- Testing normalization rules
- Testing duplicate detection

Complex join scenarios MUST:
- Use explicit mappings
- Declare all relations
- Avoid relying on fallback behavior

---

## belongsTo() Usage Rules

Tests must assume:

- `localKey` defaults to `parent.key`
- No DTO-style inference exists
- Optional relations still require column presence

When testing DTO-style keys:
- Always pass `options.localKey`
- Do not rely on naming coincidence

Tests that expect silent inference are invalid.

---

## Error Expectations Are First-Class

Tests SHOULD assert errors explicitly.

Examples:
- Missing key columns
- Missing relation columns
- Missing relation values
- Duplicate normalized columns
- Circular entity graphs (including self-references and mutual cycles)

Error assertions must:
- Assert that an error is thrown
- Avoid matching exact error strings unless necessary
- Prefer semantic expectations (e.g. "throws on missing key")

---

## No Snapshot Testing of Objects

Avoid snapshot testing mapped entities.

Reasons:
- Object shape is intentional and small
- Snapshots hide accidental fields
- Explicit assertions are clearer

Prefer:
- Checking specific properties
- Checking identity reuse across joined rows
- Checking reference equality for parents

---

## No Cross-Test State

Tests must not:

- Reuse mappings across tests unless intentional
- Share entity instances
- Depend on cache behavior across test cases

Each test must:
- Create its own mappings
- Provide its own rows
- Assert its own expectations

---

## Philosophy Summary

- Tests validate behavior, not convenience
- Explicitness beats cleverness
- Errors are expected outcomes
- Rows are data, not magic
- If a test relies on guessing, the test is wrong

When in doubt:
Make the test stricter, not the mapper looser.
