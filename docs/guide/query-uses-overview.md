---
title: Query Uses — Schema Impact Analysis
---

# Query Uses — Schema Impact Analysis

`ztd query uses` is a static analysis command that answers "which SQL queries are affected by this schema change?" without running a database.

The command-line UX is provided by `@rawsql-ts/ztd-cli`, and the reusable analysis engine behind it now lives in `@rawsql-ts/sql-grep-core`.

## Prerequisites

`ztd query uses` scans **SQL catalog spec files** — the JSON or TypeScript specs that `ztd init` generates under `src/catalog/specs/`. Each spec references a SQL file via its `sqlFile` field, and the command parses those SQL files for analysis.

**Minimum project structure:**

```text
project-root/
├── src/
│   ├── catalog/
│   │   └── specs/           ← spec files live here (default)
│   │       └── users.spec.json
│   └── sql/                 ← SQL files live here (default)
│       └── users/
│           └── list.sql
```

- **Spec files are required.** Plain `.sql` files without a spec are not scanned. If you have not run `ztd init` yet, start there.
- **Subdirectories are scanned recursively.** All specs under the specs directory (including nested folders) are discovered automatically.
- **Default paths are convention-based.** Specs default to `src/catalog/specs`, SQL root defaults to `src/sql`. Both can be overridden with `--specs-dir` and `--sql-root`.
- **No database connection is needed.** The analysis is purely static. It parses SQL text, not a live schema.

## Why not grep?

A naive `grep "sale_items"` on your SQL files will match table names, but it cannot distinguish:

- A table referenced in a `FROM` clause vs. a comment or string literal
- A column used in a `JOIN` condition vs. an unrelated alias
- Which specific statements (out of many in a project) actually depend on the target

`ztd query uses` parses each SQL statement into an AST and resolves table/column references with schema awareness. It tells you **how** each query uses the target, not just that the name appears somewhere in the file.

| Approach | Finds references | Schema-aware | Shows usage kind | Filters noise |
|----------|:---:|:---:|:---:|:---:|
| `grep` | Yes | No | No | No |
| `ztd query uses` | Yes | Yes | Yes (join, select, ...) | Yes |

## Two output formats: human and machine

Every command supports `--format text` (default) and `--format json`.

**Text** is designed for human review in the terminal:

```bash
npx ztd query uses table public.sale_lines --exclude-generated
```

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

**JSON** is designed for AI agents and CI pipelines. The same structured data is emitted as a single JSON object, making it easy to parse programmatically:

```bash
npx ztd query uses table public.sale_lines --exclude-generated --format json
```

Use `--out <path>` to write the result to a file instead of stdout, which is useful for piping into downstream tools or archiving evidence.

If you need the same AST-based impact analysis in your own tooling, import `@rawsql-ts/sql-grep-core` directly and call the report builder without the rest of the CLI.

## When to use it

### Before a table rename

> "I want to rename `sale_items` to `sale_lines`. What breaks?"

```bash
npx ztd query uses table public.sale_items --exclude-generated
```

If `matches: 2`, you know exactly which 2 queries need updating. After renaming, run the new name to confirm they moved over:

```bash
npx ztd query uses table public.sale_lines --exclude-generated
```

### Before a column rename

> "I want to rename `products.name` to `products.title`. Which queries reference it?"

```bash
npx ztd query uses column public.products.name --exclude-generated
```

### Before a column type change

> "I'm changing `sale_items.quantity` from `integer` to `numeric`. Who uses it?"

```bash
npx ztd query uses column public.sale_items.quantity --exclude-generated
```

The command does not judge type compatibility. It tells you every statement that still references the column so you can inspect each one.

### Checking a new table/column is not yet referenced

> "I just added `sale_discounts`. Is anything using it yet?"

```bash
npx ztd query uses table public.sale_discounts
```

```text
matches: 0

Affected queries:
(none)
```

A clean zero confirms no query depends on it yet.

## Detail view: edit-ready evidence

Add `--view detail` to get the exact snippet and file location for each match:

```bash
npx ztd query uses column public.products.title --view detail --exclude-generated
```

```text
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

The `location` field gives you the line and column range, so you can jump straight to the code.

## Learn more

- [Impact Checks reference](./query-uses-impact-checks.md) — full option reference, output field descriptions, scenario playbook, and troubleshooting
