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
- Work location: a **git-untracked** folder (for example `tmp/dogfood-run-<timestamp>`)
- DDL baseline is fixed to Section 2

### 1.1 Required environment capture

Before starting Scenario 1, capture these versions in the report:

- OS
- Node.js
- pnpm
- Docker Engine
- PostgreSQL image tag used for execution

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

### 4.2 Pass criteria

- Still no dev-time migration requirement
- Still no SQL string concatenation
- Generated/spec artifacts and tests updated with clear diff evidence

## 5) Fixed execution log format (required)

All runs must include a log in this exact structure:

```text
[YYYY-MM-DD HH:MM:SS] STEP <n> ACTION "<short title>"
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

## 8) Recommended run skeleton

Use this order unless a hard blocker appears.

1. Prepare untracked workspace under `tmp/`.
2. Create Docker PostgreSQL 18 container for runtime checks.
3. Scaffold project with local source linkage.
4. Apply fixed baseline DDL.
5. Implement Scenario 1 assets and tests.
6. Apply Candidate C changes for Scenario 2.
7. Regenerate affected artifacts and tests.
8. Run verification commands.
9. Produce LOG and REPORT files.
