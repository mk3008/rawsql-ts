# Deterministic ZTD Dogfooding Spec

This spec defines a deterministic dogfooding harness for `@rawsql-ts/ztd-cli` backend development.
Follow this file exactly and do not substitute ad-hoc scenarios.

## 0) Scope and objective

- Objective A: Identify where progress still requires AI reasoning.
- Objective B: Identify what can be mechanized (CLI commands, scaffolding, docs, templates, happy-path guidance).
- Objective C: Verify alignment with ZTD principles:
  - Development must not require dev-time migrations.
  - Required behavior must not require SQL string concatenation.

## 1) Fixed constraints

- PostgreSQL version: **18**
- DBMS runtime: **Docker**
- `rawsql-ts` packages: use **local source code**, not npm releases
  - This spec validates developer-mode dogfooding before publication. It does not claim to fully reproduce the published npm consumer path.
- Work location: a **git-untracked standalone folder outside any pnpm workspace/monorepo**
  - This is the default mode because real-world usage is `@rawsql-ts/ztd-cli` as an npm package in a standalone repo.
  - Windows-friendly example: `C:\Users\<you>\tmp\rawsql-ts-dogfood\run-XX\` (must NOT be under the `rawsql-ts` repository tree)
- Local-source mode note: even with `--local-source-root`, the run directory must stay standalone (outside workspace) to keep dependency resolution deterministic and avoid workspace absorption.
- DDL baseline is fixed to Section 2

### 1.1 Required environment capture

Before starting Scenario 1, capture these versions in the report:

- OS
- Node.js
- pnpm
- Docker Engine
- PostgreSQL image tag used for execution

### 1.2 Local-source invocation (recommended developer mode)

Use this canonical local-source invocation form from `<RUN_DIR>`:

```bash
node "<LOCAL_SOURCE_ROOT>/packages/ztd-cli/dist/index.js" <ztd-subcommand-and-args>
```

- `<LOCAL_SOURCE_ROOT>`: absolute path to the `rawsql-ts` repository root.
- `<RUN_DIR>`: standalone dogfooding run directory (outside any workspace), where commands are executed.
- If `dist/index.js` is missing, build once from `<LOCAL_SOURCE_ROOT>`:

```bash
pnpm -C "<LOCAL_SOURCE_ROOT>" --filter @rawsql-ts/ztd-cli build
```

Note: model-gen (probe-mode ztd) requires DATABASE_URL. Also, model-gen is currently SELECT-oriented; INSERT/UPDATE/DELETE SQL may fail with parser errors and is out of scope for model-gen in this dogfooding scenario.

Note on modes:

- `Developer mode` means local-source execution from a repo checkout without publishing first.
- `Published package mode` means installing released packages from npm in a standalone repo.
- This spec is intentionally about `Developer mode` so backend dogfooding does not depend on package publication.
- When you need a pre-release check for the npm consumer path, run the separate repository-root workflow in [Published-Package Verification Before Release](../guide/published-package-verification.md).

## 2) Fixed DDL baseline

Create `schema.sql` with the exact content below.

```sql
-- schema.sql

create table product (
  product_id bigserial primary key,
  sku text not null unique,
  name text not null,
  price_yen integer not null check (price_yen >= 0),
  created_at timestamptz not null default now()
);

create table sale (
  sale_id bigserial primary key,
  sale_date date not null,
  customer_note text null,
  created_at timestamptz not null default now()
);

create table sale_line (
  sale_line_id bigserial primary key,
  sale_id bigint not null references sale(sale_id),
  product_id bigint not null references product(product_id),
  qty integer not null check (qty > 0),
  unit_price_yen integer not null check (unit_price_yen >= 0)
);

create index sale_line_sale_id_idx on sale_line(sale_id);
create index sale_line_product_id_idx on sale_line(product_id);
```

## 3) Scenario 1 (New backend)

Implement sale backend features:

- Create sale with lines
- List sales (pagination optional)
- Get sale by id (including lines)
- Update sale (customer note + replace lines)
- Delete sale

### 3.1 Required artifacts

- SQL assets (DDL + queries)
- Repository or equivalent backend code
- Tests (unit or integration)

### 3.2 Pass criteria

- No dev-time migration requirement
- No SQL string concatenation for required behavior
- Artifacts and tests are executable with clear file evidence

## 4) Scenario 2 (Schema/spec changes)

Scenario 2 validates survivability under deterministic change.

### 4.1 Candidate C (fixed)

Apply all of the following fixed changes.

1. Add table `payment`
2. Add `payment.sale_id` referencing `sale(sale_id)`
3. Add a new query joining `sale` and `payment` to return sales with payment info

Append the following DDL:

```sql
create table payment (
  payment_id bigserial primary key,
  sale_id bigint not null references sale(sale_id),
  paid_at timestamptz not null,
  amount_yen integer not null check (amount_yen >= 0),
  method text not null, -- e.g. "cash", "card"
  created_at timestamptz not null default now()
);

create index payment_sale_id_idx on payment(sale_id);
create index payment_paid_at_idx on payment(paid_at);
```

Query requirements (fixed):

- Inputs: `:from_paid_at`, `:to_paid_at`
- Output fields:
  - `sale.sale_id`, `sale.sale_date`
  - `payment.payment_id`, `payment.paid_at`, `payment.amount_yen`, `payment.method`
- Join: `payment.sale_id = sale.sale_id` (**INNER JOIN**)
- Filter: date range on `payment.paid_at`

Rule: For Scenario 2 runs, use a fresh Postgres container / fresh database to apply the updated schema, to avoid noisy "relation already exists" output and keep logs comparable.
OPTIONAL (destructive): If you must reuse a DB, reset schema first: `drop schema public cascade; create schema public;`. CAUTION: LOCAL/DISPOSABLE DB ONLY — DO NOT RUN IN PRODUCTION OR ON SHARED DATABASES.

### 4.2 Pass criteria

- Still no dev-time migration requirement
- Still no SQL string concatenation
- Generated/spec artifacts and tests updated with clear diff evidence

## 5) Fixed execution log format (required)

All runs must include a log in this exact structure:

```text
[YYYY-MM-DDTHH:MM:SSZ] STEP <n> ACTION "<short title>" (UTC recommended)
CMD:
<command line>
RESULT:
(exit=<code>)
STDOUT:
<first 30 lines or summary>
STDERR:
<first 30 lines or summary>
NOTES:
<why ran it, what learned, next>
```

## 6) Fixed report template (required)

Submit `DOGFOOD_REPORT.md` using this template.

```markdown
# DOGFOOD REPORT

## Metadata
- Run date:
- Runner:
- Spec file:
- Repo commit:

## Environment
- OS:
- Node.js:
- pnpm:
- Docker:
- PostgreSQL image:

## Files changed
- <path>

## Scenario 1: New backend
- Result: PASS | PARTIAL | FAIL
- Implemented scope:
- Evidence pointers: LOG STEP <n>, <n>
- Notes:

## Scenario 2: Schema/spec changes (Candidate C)
- Result: PASS | PARTIAL | FAIL
- Change summary:
- Evidence pointers: LOG STEP <n>, <n>
- Notes:

## Command and trial metrics
- Total step count:
- Trial/error count:
- Commands that required retries:

## Frictions

### Needs CLI automation
- <item>
  - Evidence: LOG STEP <n>

### Feature exists but undiscoverable
- <item>
  - Evidence: LOG STEP <n>

### Forces migration (ZTD violation)
- <item or "None observed">
  - Evidence: LOG STEP <n>

### Forces SQL string concatenation (security risk)
- <item or "None observed">
  - Evidence: LOG STEP <n>

## Improvement proposals
- CLI:
- Docs:
- Discoverability:
- Templates/scaffolding:

## Happy-path draft (shortest successful steps)
1. <step>
2. <step>
3. <step>

## Open questions
- <item or "None">
```

## 7) Deterministic run rules

- Do not alter scenario definitions during execution.
- If blocked, do not change goals; record the block in LOG and REPORT.
- Distinguish strictly between:
  - mechanizable repetition (CLI/docs/template candidates)
  - judgment-required work (domain design, naming, contract semantics)

## 7.1) Lint placeholder handling note

Note: ztd lint validates SQL via Postgres. When queries contain placeholders ($1, $2, or named params), lint injects default bindings (e.g. null) to avoid unbound-parameter failures (42P02) and to surface SQL-level diagnostics instead.

## 7.2) OPTIONAL: Running inside a workspace (not recommended)

- If you run under a directory governed by a parent `pnpm-workspace.yaml`, pnpm may absorb installs into the parent workspace.
- This can introduce unrelated dependency-resolution friction and reduce determinism for dogfooding signals.
- This mode is intentionally not the default because it does not represent typical npm-package users.
## Companion scenarios

For focused companion flows, use these scenario documents instead of expanding this backend-focused harness inline:

- [SQL Debug Recovery Dogfooding](./sql-debug-recovery.md)
- [SSSQL Optional-Condition Dogfooding](./sssql-optional-condition.md)
- [Test Documentation Dogfooding](./test-documentation.md)

Those companion scenarios cover broken long-CTE SQL recovery, query graph / query slice / query patch apply usage, truthful optional-condition authoring with SSSQL, direct-vs-decomposed perf evidence loops, and the human-readable test documentation export path.
## 8) Recommended run skeleton

Use this order unless a hard blocker appears.

1. Prepare an untracked standalone workspace outside any pnpm workspace (for example `C:\Users\<you>\tmp\rawsql-ts-dogfood\run-XX\`).
2. Create Docker PostgreSQL 18 container for runtime checks.
3. Scaffold project with local source linkage.
4. Apply fixed baseline DDL.
5. Implement Scenario 1 assets and tests.
6. Apply Candidate C changes for Scenario 2.
7. Regenerate affected artifacts and tests.
8. Run verification commands.
9. Produce LOG and REPORT files.
