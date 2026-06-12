---
title: SSSQL Optional Branch Pruning MVP
outline: deep
---

# SSSQL Optional Branch Pruning MVP

This note documents the intentionally narrow first pass for truthful optional-condition pruning.

## Supported syntax shapes

The MVP only inspects top-level `AND` terms under a query block's `WHERE` clause.
One outer set of parentheses is tolerated around each branch.

Supported branch forms:

```sql
(:p IS NULL OR t.col = :p)
```

```sql
(:p IS NULL OR EXISTS (... :p ...))
```

```sql
(:p IS NULL OR NOT EXISTS (... :p ...))
```

Scalar predicates currently accept the comparison and match operators handled by the matcher.
`EXISTS` / `NOT EXISTS` branches are only eligible when the subquery references the same parameter and no additional parameters appear in that branch.

## Unsupported syntax shapes

The MVP is exact no-op for any branch that is not a direct top-level `AND` term, including:

- nested boolean rewrites
- mixed `OR` chains with more than one meaningful branch
- ambiguous guard shapes
- branches that rely on extra parameters
- general boolean simplification outside the targeted branch forms

## Opt-in parameter targeting

Pruning is explicit opt-in.
Only parameter names listed in `optionalConditionParameters` (or passed directly to `pruneOptionalConditionBranches`) are eligible.
Parameters that are not listed remain exact no-op, even if the SQL shape itself is supported.

## Known-absent definition

For explicitly targeted parameters, the MVP treats `null` and `undefined` as absent-equivalent.
Any other value keeps the branch active, and the MVP does not simplify the known-present branch.

## No-op policy

Only supported branches with an explicitly targeted absent-equivalent parameter are normalized away.
Known-present branches remain unchanged.
Unsupported or ambiguous shapes remain byte-for-byte intent no-op at the AST level, aside from formatter normalization when SQL is printed.
