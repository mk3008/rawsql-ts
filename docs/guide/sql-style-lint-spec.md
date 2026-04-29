---
title: SQL Style Lint Specification
---

# SQL Style Lint Specification

`ztd query lint --rules leading-comma` checks generated or maintained SQL for multiline comma placement without rewriting the file.

Use this rule when a package wants leading commas in multiline SQL lists and wants the check to be enforced by tooling instead of reviewer memory.

## Why lint-only

The style check is intentionally lint-only. SQL formatting can change comment placement, and comment round-tripping must be proven separately before automatic style rewrites become safe for generated SQL workflows.

The rule validates that the SQL parses through rawsql-ts first, then reports source locations where a comma remains at the end of a continued line.

## Usage

```sh
ztd query lint path/to/query.sql --rules leading-comma
```

Use comma-separated rules when combining style and structure checks:

```sh
ztd query lint path/to/query.sql --rules join-direction,leading-comma
```

## Reported pattern

This reports a warning because the comma trails the previous line:

```sql
select
  id,
  email
from public.users
```

The preferred leading-comma form is clean:

```sql
select
  id
  , email
from public.users
```

One-line lists are not reported:

```sql
select id, email from public.users
```

## Suppression

Use a local suppression only when a generated query needs an intentional exception:

```sql
-- ztd-lint-disable leading-comma
select
  id,
  email
from public.users
```

The suppression disables only the `leading-comma` rule for that SQL text.
