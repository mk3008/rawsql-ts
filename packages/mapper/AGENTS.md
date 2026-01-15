# AGENTS: Mapper Design Principles

This document defines the **non-negotiable design philosophy** of `@rawsql-ts/mapper`.
It exists to keep the mapper small, predictable, and independent from DBMS,
drivers, ORMs, and test frameworks.

The mapper is intentionally strict.
When behavior is ambiguous, it must fail fast rather than guess.

---

## Scope and Responsibility

The mapper's responsibility is **only this**:

- Convert SQL result rows into JavaScript/TypeScript objects
- Stitch related objects together using explicit mapping rules

The mapper does NOT:
- Execute SQL by itself
- Manage database connections
- Know about Postgres, MySQL, SQLite, etc.
- Know about rawsql-ts, ZTD, or testkits
- Validate domain rules
- Perform schema inference

It consumes rows.
How rows are produced is outside its concern.

---

## DBMS and Driver Independence

The mapper is DBMS-agnostic by design.

- It operates on plain objects: `{ [columnName: string]: unknown }`
- It depends only on column names and values
- It does not assume Postgres-specific behavior (OID, arrays, JSONB, etc.)

Think of it as operating on something equivalent to C#'s `IDataReader`:
- The reader exists
- The mapper does not care how it was created

If DB-specific behavior is desired, it must live **outside** this package.

---

## Explicitness Over Convention

The mapper prefers **explicit configuration** over conventions.

### Column Mapping

- SQL column names are authoritative
- DTO / domain naming conventions must not leak into SQL
- If names do not align, TypeScript-side mappings must fix the mismatch

Examples:
- Prefix-based mapping is allowed
- Explicit `columnMap` overrides are allowed
- Implicit guessing beyond that is not

---

## Relations: No Hidden Inference

Relations must be declared explicitly.

### belongsTo()

  - `localKey` is **never inferred by naming conventions**
  - Default `localKey` is always `parent.key`
  - If DTO-style keys are desired (`userId`, `orderId`, etc),
    they must be passed explicitly via `options.localKey`
  - `optional: true` only removes the requirement to hydrate every row; it still requires the local/parent columns to exist and only allows null/undefined to skip the relation.

This avoids leaking object-model assumptions into SQL design.

---

## Strict Failure Policy

When required information is missing, the mapper must throw.

### Required behavior

- Missing key columns => throw
- Missing required relation columns => throw
- Missing required relation values => throw
- Circular entity graphs => throw (tracked by `mapping.name + ':' + key` so shared references are fine but true recursion fails fast)
- Non-serializable entity keys => throw

  ### Optional relations

  - `optional: true` only allows **null or undefined values**
  - Column absence is still an error
  - Optional does not enable fallback or inference
  - Valid local/parent columns must still appear; only actual null/undefined data allows the relation to be skipped.

---

## Duck-Typed Mapping Is a Convenience, Not Magic

When no mapping is provided:

  - Columns are normalized mechanically
  - Name collisions after normalization MUST throw
  - Duplicate normalized columns are fatal; SQL must provide explicit aliases rather than relying on fallbacks.
  - SQL must be fixed using explicit aliases

Duck typing is provided for:
- Prototyping
- Simple queries
- Tooling experiments

It is not meant to replace explicit mappings for complex joins.

---

## Identifier conversion & type hints

- The mapper defaults to `snake_to_camel` normalization with `idKeysAsString: true`. Identifier properties named `id` or camelCase ending in `Id` become strings so that Postgres-style `bigint` primary keys remain JSON-friendly, but names like `userid`, `grid`, or `identity` are intentionally excluded.
- `typeHints` is the explicit map from the DTO property name after normalization to `'string', `'number', `'boolean', `'date', or `'bigint'. Hints run before the identifier guard and before custom `coerceFn`, so an explicit statement always wins. Add a hint to keep `id` as `bigint` or to parse `createdAt` as a `Date`, or set `idKeysAsString: false` if you simply want to skip stringification for that query.
- The override order is `typeHints > query options > mapper defaults > built-in defaults`. There is no other mechanism to guess column types, so these settings are the only levers for toggling normalization, coercion, or identifier serialization.

---

## Minimal Fallbacks Are Intentional

Fallbacks increase ambiguity.
Ambiguity hides bugs.

Therefore:
- The mapper does not try alternative columns
- The mapper does not silently overwrite values
- The mapper does not guess intent

If behavior is unclear, the correct outcome is an error.

---

## Philosophy Summary

- SQL owns column names
- TypeScript adapts to SQL, not the other way around
- Explicit mappings are clarity
- Errors are safer than guesses
- Independence is a feature, not a limitation

If a feature threatens these principles, it does not belong in this package.
