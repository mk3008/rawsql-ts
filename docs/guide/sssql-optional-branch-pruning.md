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

Scalar predicates currently accept the standard comparison operators handled by the matcher.
`EXISTS` branches are only eligible when the subquery references the same parameter and no additional parameters appear in that branch.

## Unsupported syntax shapes

The MVP is exact no-op for any branch that is not a direct top-level `AND` term, including:

- nested boolean rewrites
- mixed `OR` chains with more than one meaningful branch
- ambiguous guard shapes
- branches that rely on extra parameters
- general boolean simplification outside the targeted branch forms

## Known-absent definition

`known-absent` means the compile-time state map marks the parameter as `absent`.
This MVP does not treat `null` as absent and does not infer absence from SQL values.

## No-op policy

Only supported branches with a `known-absent` guard are normalized away.
Known-present branches remain unchanged.
Unsupported or ambiguous shapes remain byte-for-byte intent no-op at the AST level, aside from formatter normalization when SQL is printed.
