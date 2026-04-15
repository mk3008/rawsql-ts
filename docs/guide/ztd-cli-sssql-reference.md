---
title: ztd-cli SSSQL Reference
outline: deep
---

# ztd-cli SSSQL Reference

This page is the single reference for the `ztd query sssql ...` command family and the matching runtime pruning contract in `rawsql-ts`.

Use it when you need to answer questions like:

- Which command adds an optional branch?
- How do I inspect authored branches before removing one?
- What is the difference between `scaffold`, `remove`, and `refresh`?
- Which operators and branch kinds are supported?

For the conceptual introduction, read [What Is SSSQL?](./sssql-overview.md).
For authoring guidance, read [ztd-cli SSSQL Authoring](./ztd-cli-sssql-authoring.md).

## Command Summary

| Command | What it does | Typical use |
|---|---|---|
| `ztd query sssql list <sqlFile>` | Inspect supported authored SSSQL branches in a SQL file | Confirm what is present before `remove` or `refresh` |
| `ztd query sssql scaffold <sqlFile> ...` | Add one supported optional branch | Add a scalar or `EXISTS` / `NOT EXISTS` optional condition |
| `ztd query sssql remove <sqlFile> ...` | Remove one supported authored branch | Undo a scaffold or clean up an old optional condition |
| `ztd query sssql refresh <sqlFile>` | Re-anchor supported branches near the closest source query without changing predicate meaning | Re-run after query edits moved the best insertion point |

All rewriting commands support `--preview`, which emits a unified diff instead of writing the file.

## `list`

Use `list` to inspect the branches the CLI can currently recognize and manage safely.

```bash
ztd query sssql list src/sql/products/list_products.sql
ztd query sssql list src/sql/products/list_products.sql --format json
```

`list` is the safest first step before `remove`, and it is also useful for machine-readable automation.

Supported branch kinds currently reported by `list`:

- `scalar`
- `exists`
- `not-exists`
- `expression`

The output includes branch metadata such as `parameterName`, `kind`, and, when available, operator or target details.

### Sample text output

```text
1. parameter: brand_name
   kind: scalar
   operator: =
   target: p.brand_name
   sql: (:brand_name is null or "p"."brand_name" = :brand_name)
2. parameter: category_name
   kind: exists
   sql: (:category_name is null or exists (select 1 from "product_categories" as "pc" where "pc"."product_id" = "p"."product_id" and "pc"."category_name" = :category_name))
```

### Sample JSON output

```json
{
  "command": "query sssql list",
  "ok": true,
  "data": {
    "file": "src/sql/products/list_products.sql",
    "branch_count": 2,
    "branches": [
      {
        "index": 1,
        "parameterName": "brand_name",
        "kind": "scalar",
        "operator": "=",
        "target": "p.brand_name",
        "sql": "(:brand_name is null or \"p\".\"brand_name\" = :brand_name)"
      },
      {
        "index": 2,
        "parameterName": "category_name",
        "kind": "exists",
        "operator": null,
        "target": null,
        "sql": "(:category_name is null or exists (...))"
      }
    ]
  }
}
```

If you only need the recognized parameter names, extract `branches[].parameterName` from the JSON output.

## `scaffold`

Use `scaffold` to add one supported optional branch to the closest query scope that owns the target columns.

### Scalar scaffold

```bash
ztd query sssql scaffold src/sql/products/list_products.sql \
  --filter p.brand_name \
  --parameter brand_name \
  --operator =
```

Supported scalar operators:

- `=`
- `<>`
- `!=`
- `<`
- `<=`
- `>`
- `>=`
- `like`
- `ilike`

Notes:

- `<>` is the normalized SQL form.
- `!=` is accepted as input and normalized to `<>`.
- `ilike` is a PostgreSQL-specific extension, not SQL standard.

### `EXISTS` / `NOT EXISTS` scaffold

Use structured scaffold input when the optional condition depends on a table that is not already filtered directly in the outer `FROM` graph.

```bash
ztd query sssql scaffold src/sql/products/list_products.sql \
  --parameter category_name \
  --kind exists \
  --query-file tmp/category_exists.sql \
  --anchor-column p.product_id
```

```bash
ztd query sssql scaffold src/sql/products/list_products.sql \
  --parameter category_name \
  --kind not-exists \
  --query "select 1 from public.product_categories pc where pc.product_id = $c0 and pc.category_name = :category_name" \
  --anchor-column p.product_id
```

Structured `EXISTS` / `NOT EXISTS` contract:

- Pass exactly one subquery via `--query` or `--query-file`
- Use `--kind exists` or `--kind not-exists`
- Provide one or more `--anchor-column` values
- Reference anchor columns inside the subquery as `$c0`, `$c1`, and so on
- Keep the subquery to one statement only

The CLI rewrites `$c0`, `$c1`, and similar placeholders to the resolved outer column expressions before inserting the branch.

### Preview mode

Use `--preview` whenever you want to inspect the diff before writing:

```bash
ztd query sssql scaffold src/sql/products/list_products.sql \
  --filter p.brand_name \
  --parameter brand_name \
  --operator ilike \
  --preview
```

### JSON mode

Automation can use `--json` instead of many flags:

```bash
ztd query sssql scaffold src/sql/products/list_products.sql --json '{
  "parameter": "category_name",
  "kind": "exists",
  "query": "select 1 from public.product_categories pc where pc.product_id = $c0 and pc.category_name = :category_name",
  "anchorColumns": ["p.product_id"]
}'
```

## `remove`

Use `remove` to delete one supported optional branch safely.

```bash
ztd query sssql remove src/sql/products/list_products.sql --parameter category_name
ztd query sssql remove src/sql/products/list_products.sql --parameter category_name --preview
```

### Required input

`remove` requires either:

- `<sqlFile>` and `--parameter <name>`
- `<sqlFile>` and `--all`

Primary identity is `--parameter`.
When one parameter could match more than one branch, narrow the target with one or more of:

- `--kind`
- `--operator`
- `--target`

Example:

```bash
ztd query sssql remove src/sql/products/list_products.sql \
  --parameter brand_name \
  --kind scalar \
  --operator <>
```

### What `remove` can remove

`remove` removes one branch that the CLI can already recognize through `list`.

- If `list` shows the branch, `remove` can target it
- If `list` does not show the branch, `remove` does not manage it safely

`remove` is idempotent.
If the matching branch is already absent, the command becomes a no-op instead of damaging the query.

### Remove all branches at once

Use `--all` to remove every recognized SSSQL branch in the query:

```bash
ztd query sssql remove src/sql/products/list_products.sql --all
ztd query sssql remove src/sql/products/list_products.sql --all --preview
```

Rules for `--all`:

- it removes every branch that `list` can recognize
- it is idempotent
- use it by itself
- do not combine it with `--parameter`, `--kind`, `--operator`, or `--target`

This keeps bulk removal explicit and avoids accidental over-broad deletes from a partially specified targeted remove command.

## `refresh`

Use `refresh` after query edits changed the closest correct query scope for an authored SSSQL branch.

```bash
ztd query sssql refresh src/sql/products/list_products.sql
ztd query sssql refresh src/sql/products/list_products.sql --preview
```

`refresh` does not invent new optional predicates.
It only repositions supported authored branches so they stay attached to the best matching query block after query structure changes.

`refresh` also supports correlated `EXISTS` / `NOT EXISTS` branches.
When a branch is still attached to an outer query but the anchor column now belongs in an inner query or CTE, `refresh` can move the whole branch and rebase the correlated alias safely.

Correlated `EXISTS` / `NOT EXISTS` refresh rules:

- infer one anchor candidate from the correlated outer reference
- fail fast when zero anchor candidates are found
- fail fast when multiple anchor candidates are found
- keep scalar branch behavior unchanged

## Safety Rules

These commands are intentionally strict.

- Repeated scaffold with the same semantic input is idempotent and does not duplicate the branch
- Repeated remove is idempotent and becomes a no-op when the branch is already gone
- Ambiguous remove or unsafe scaffold input fails fast
- `EXISTS` / `NOT EXISTS` scaffold rejects empty SQL, semicolons, multiple statements, and `LATERAL`
- If a rewrite would drop existing SQL comments, the command fails instead of silently writing a damaged file

The goal is to prefer an explicit error over a quietly corrupted SQL file.

## Runtime API

The CLI authors the optional branch into the SQL file.
Runtime behavior is still controlled explicitly by `optionalConditionParameters`.

```ts
const query = builder.buildQuery(sql, {
  optionalConditionParameters: {
    brand_name: input.brandName ?? null,
    category_name: input.categoryName ?? null,
  },
});
```

Pruning rules:

- present value: keep the branch
- `null` or `undefined`: prune the optional branch
- omit `optionalConditionParameters`: do not run pruning

This means the CLI is for authoring, while runtime pruning is still an explicit application-level choice.

## Choosing The Right Document

- Concept and tradeoffs: [What Is SSSQL?](./sssql-overview.md)
- SQL-first authoring workflow: [ztd-cli SSSQL Authoring](./ztd-cli-sssql-authoring.md)
- Runtime pruning rules: [SSSQL Optional Branch Pruning MVP](./sssql-optional-branch-pruning.md)
- Dynamic-vs-SSSQL decision: [Dynamic Filter Routing](./dynamic-filter-routing.md)
