---
title: Query Uses Impact Checks
---

# Query Uses Impact Checks

Use `ztd query uses` when you need to answer a schema-change question before editing SQL or repositories:

- "Does anything reference this table?"
- "Which queries still use the old column name?"
- "If this type changes, which statements do I need to inspect?"

This page covers the `table` and `column` impact checks with examples based on a sample sales project.

Implementation note: the CLI command is provided by `@rawsql-ts/ztd-cli`, while the reusable analysis engine now lives in `@rawsql-ts/sql-grep-core`.

## Quick start

The default view is `impact`, which is the fastest first pass for "used or not, and by which queries?".

```bash
npx ztd query uses table public.sale_items
npx ztd query uses column public.sale_items.quantity
```

Use `--view detail` when you need edit-ready evidence:

```bash
npx ztd query uses table public.sale_items --view detail
npx ztd query uses column public.sale_items.quantity --view detail
```

Use `--exclude-generated` when generated or probe specs would otherwise add noise to rename and type-change investigations:

```bash
npx ztd query uses table public.sale_items --exclude-generated
npx ztd query uses table public.sale_lines --exclude-generated
npx ztd query uses column public.products.title --exclude-generated
npx ztd query uses column public.sale_items.quantity --exclude-generated
npx ztd query uses table public.sale_lines --view detail --exclude-generated
```

`--exclude-generated` only excludes specs under `src/catalog/specs/generated`. The flag is optional, and the default scan set is unchanged.

## When to use which command

### Table add / column add

Use the default scan first. In the common "new object not referenced yet" case, the answer should be a clean no-hit.

```bash
npx ztd query uses table public.sale_discounts
npx ztd query uses column public.sales.discount_rate
```

Typical output:

```text
mode: exact
view: impact
target: table public.sale_discounts
catalogs: 9
statements: 9
matches: 0
fallback matches: 0
parse warnings: 0
unresolved sql files: 0

Affected queries:
(none)
```

### Table rename / column rename / column type change

Prefer `--exclude-generated`. These scenarios are more likely to pick up review-only generated specs or probe scaffolds, and excluding them makes the impact list easier to act on.

```bash
npx ztd query uses table public.sale_items --exclude-generated
npx ztd query uses table public.sale_lines --exclude-generated
npx ztd query uses column public.products.title --exclude-generated
npx ztd query uses column public.sale_items.quantity --exclude-generated
```

Example difference for a rename check:

- Without the flag: `catalogs: 9`, `matches: 3`
- With `--exclude-generated`: `catalogs: 5`, `matches: 1`

## Reading the output

### Impact view

`impact` aggregates by statement fingerprint and answers "which query contracts are affected?".

Example:

```text
mode: exact
view: impact
target: table public.sale_lines
catalogs: 5
statements: 5
matches: 2
fallback matches: 0
parse warnings: 0
unresolved sql files: 0

Affected queries:
- sales.byId sales.byId:1 high
  sql_file: src/sql/sales/get-sale-by-id.sql
  statement_fingerprint: 1dc4401557aa
  source: ast
  usageKinds: join=1
  notes: (none)
- sales.list sales.list:1 high
  sql_file: src/sql/sales/list-sales.sql
  statement_fingerprint: 03249e9c4052
  source: ast
  usageKinds: join=1
  notes: (none)
```

What to look at:

- `matches`: how many catalog statements were found
- `unresolved sql files`: should usually be `0`
- `usageKinds`: why the statement matched (`join`, `select`, etc.)
- `notes`: ambiguity or fallback hints

### Detail view

`detail` expands the matches and gives you snippets plus locations that you can edit directly.

Table detail example:

```text
mode: exact
view: detail
target: table public.sale_lines
catalogs: 5
statements: 5
matches: 2
fallback matches: 0
parse warnings: 0
unresolved sql files: 0

Primary matches:
- sales.byId sales.byId:1 join high
  sql_file: src/sql/sales/get-sale-by-id.sql
  statement_fingerprint: 1dc4401557aa
  source: ast
  snippet: left join public.sale_lines as si
  notes: (none)
  exprHints: (none)
  location: 12:11-12:28 @ 346-363
```

Column detail example:

```text
mode: exact
view: detail
target: column public.products.title
catalogs: 5
statements: 5
matches: 1
fallback matches: 0
parse warnings: 0
unresolved sql files: 0

Primary matches:
- sales.byId sales.byId:1 select high
  sql_file: src/sql/sales/get-sale-by-id.sql
  statement_fingerprint: b80eaec367cd
  source: ast
  snippet: p.title, ', ' order by si.line_no) as product_names
  notes: (none)
  exprHints: function, projection
  location: 10:14-10:21 @ 262-269
```

## Scenario playbook

### 1. Rename a table

Run the old name first, then the new name.

```bash
npx ztd query uses table public.sale_items --exclude-generated
npx ztd query uses table public.sale_lines --exclude-generated
npx ztd query uses table public.sale_lines --view detail --exclude-generated
```

Expected pattern:

- Before SQL updates: old name has matches, new name has none
- After SQL updates: old name drops to zero, new name gains matches

### 2. Rename a column

```bash
npx ztd query uses column public.products.name --exclude-generated
npx ztd query uses column public.products.title --exclude-generated
npx ztd query uses column public.products.title --view detail --exclude-generated
```

Expected pattern:

- Before SQL updates: old name has matches, new name has none
- After SQL updates: old name drops to zero, new name gains matches

### 3. Change a column type

```bash
npx ztd query uses column public.sale_items.quantity --exclude-generated
npx ztd query uses column public.sale_items.quantity --view detail --exclude-generated
```

Expected pattern:

- The command does not judge type compatibility
- It does tell you every statement that still references the column

## Troubleshooting

### `unresolved sql files` is not zero

Check that your `spec.sqlFile` values still point at the project SQL root. `query uses` resolves `spec.sqlFile` against `src/sql` first and then falls back to the legacy spec-relative behavior for backward compatibility.

If needed, be explicit:

```bash
npx ztd query uses table public.users --sql-root src/sql
```

### Matches look noisy

Try `--exclude-generated` first.

```bash
npx ztd query uses table public.sale_items --exclude-generated
```

If you still need proof for a specific hit, switch to `--view detail`.

```bash
npx ztd query uses table public.sale_items --view detail --exclude-generated
```

## Recommended workflow

1. Start with the default `impact` view.
2. Add `--exclude-generated` for rename or type-change checks.
3. Use `--view detail` only when you need line-level evidence.
4. Treat `unresolved sql files` as a signal that the scan setup needs attention before you trust the result.
