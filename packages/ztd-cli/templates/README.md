# Zero Table Dependency Project

This project organizes all SQL‑related artifacts under the `ztd/` directory, separating concerns so both humans and AI can collaborate effectively without interfering with each other's responsibilities.

```
/ztd
  /ddl
    *.sql            <- schema definitions (required)
  README.md          <- documentation for the layout
  AGENTS.md          <- combined guidance for DDL

/src                 <- application & repository code
  /sql
    /<table_name>     <- CRUD + SELECT SQL (named params)
  /repositories
    /views            <- read-only repositories
    /tables           <- table repositories (SQL-first)
  /jobs               <- job runners that execute SQL from src/sql/<table_name>
/tests               <- ZTD tests, fixtures, generated maps
```

Only `ztd/ddl` is part of the template contract. Do not create or assume other `ztd` subdirectories unless the project explicitly adds them.

## Generated files (important)

`tests/generated/` is auto-generated and must never be committed to git.
After cloning the repository (or in a clean environment), run (strongly recommended):

```bash
npx ztd ztd-config
```

If TypeScript reports missing modules or type errors because `tests/generated/` is missing, rerun `npx ztd ztd-config`.

`tests/generated/ztd-layout.generated.ts` declares the directories above so the CLI and your tests always point at the intended files. The authoritative directory remains `ztd/ddl/`; do not read or assume additional `ztd` subdirectories.

---

# Optional SqlClient seam

If this project was initialized with `npx ztd init --with-sqlclient`, you'll also have `src/db/sql-client.ts`.
It defines a minimal `SqlClient` interface that repositories can depend on:

- Use it for tutorials and greenfield projects to keep repository SQL decoupled from drivers.
- Skip it when you already have a database abstraction (Prisma, Drizzle, Kysely, custom adapters).
- For `pg`, adapt `client.query(...)` so it returns a plain `T[]` row array that matches the interface.
- Prefer a shared client per worker process so tests and scripts do not reconnect on every query.
- Do not share a live connection across parallel workers; each worker should own its own shared client.

Example (driver-agnostic):

```ts
let sharedClient: SqlClient | undefined;

export function getSqlClient(): SqlClient {
  if (!sharedClient) {
    // Create the client once using your chosen driver (pg, mysql, etc.).
    sharedClient = createSqlClientOnce();
  }
  return sharedClient;
}
```

---

# Runtime validation (required)

- `ztd init` always adds `@rawsql-ts/sql-contract` and asks you to pick a validator backend (Zod or ArkType). Use `docs/recipes/sql-contract.md` for the canonical mapping wiring before applying validation.
- When Zod is selected, follow `docs/recipes/validation-zod.md` (with `zod` as the validator dependency).
- When ArkType is selected, follow `docs/recipes/validation-arktype.md` (with `arktype` as the validator dependency).

# Repository samples (SQL-first)

- Read-only repositories live under `src/repositories/views/` and load SQL from `src/sql/<table_name>/` (for example `src/repositories/views/user-profiles.ts` + `src/sql/user_account/list_user_profiles.sql`).
- CUD helpers live under `src/repositories/tables/` and execute SQL from `src/sql/<table_name>/` (see `src/repositories/tables/user-accounts.ts`).
- Batch updates live under `src/sql/<table_name>/`, with execution wrappers in `src/jobs/` (for example `src/sql/user_account/refresh_user_accounts.sql` + `src/jobs/refresh-user-accounts.ts`).
- The template tests exercise the example repositories, and `ztd/ddl` is the authoritative source for every column and constraint.
- Regenerate `tests/generated/ztd-row-map.generated.ts` (`npx ztd ztd-config`) before running the example tests so the row map reflects any schema changes.
- The example tests require a real PostgreSQL connection via `DATABASE_URL`; they automatically skip when the variable is missing so local tooling stays fast.

# Principles

### 1. Humans own the *definitions*
- DDL (physical schema)
  Only `ztd/ddl` is part of the template contract; other subdirectories should not be assumed.

### 2. AI owns the *implementation*
- Repository SQL generation
- Test fixture updates
- Intermediate TypeScript structures
- SQL rewriting, parameter binding, shape resolution

### 3. ZTD ensures these stay in sync
ZTD acts as the consistency layer ensuring:
- DDL → SQL shape consistency
- Do not rely on other directories unless the project explicitly adds them.

If any part diverges, ZTD tests fail deterministically.

---

# Workflow Overview

Different tasks start from different entry points. Choose the workflow that matches what you want to change.

---

# Workflow A — Starting From *DDL Changes*  
(Adding tables/columns, changing constraints)

1. Edit files under `ztd/ddl/`.
2. Run:

   ```bash
   npx ztd ztd-config
   ```

   This regenerates `tests/generated/ztd-row-map.generated.ts` from the new schema.

3. Update repository SQL so it matches the new schema.
4. Update fixtures if shapes changed.
5. Run tests. Any schema mismatch will fail fast.

**Flow:**  
**DDL -> repository SQL -> fixtures/tests -> application**

---

# Workflow B — Starting From *Repository Interface Changes*  
(Adding a method, changing return types, etc.)

1. Modify the repository interface or class in `/src`.
2. Allow AI to generate the SQL needed to satisfy the interface.
3. If the query contradicts DDL, reconcile the authoritative definition before continuing.
4. Run ZTD tests to confirm logic is consistent.
5. Regenerate ZTD config if result shapes changed.

**Flow:**  
**repository interface -> SQL -> tests**

---

# Workflow C — Starting From Repository SQL Logic Changes
(Fixing a bug, optimizing logic, rewriting a query)

1. Edit SQL inside the repository.
2. Run ZTD tests.
3. If the intended behavior changes, update the DDL before adjusting dependent logic and keep documentation aligned with the confirmed schema.
4. Update fixtures as necessary.
5. If SQL result shape changed, run:

   ```bash
   npx ztd ztd-config
   ```

**Flow:**  
**SQL -> fixtures/tests**

---

# Combined Real‑World Flow Examples

- **Add a new contract status**  
  DDL -> SQL -> config -> tests

- **Add a new table**  
  DDL -> config -> SQL -> fixtures -> tests

- **Fix business logic**  
  SQL -> tests

ZTD ensures all changes converge into a consistent, validated workflow.
---

# Human Responsibilities

- Humans maintain:
  - Physical schema (`ddl`)
  - High‑level repository interfaces
  - Acceptance of AI-generated changes

Humans decide “what is correct.”

---

# AI Responsibilities

AI must:

  - Use DDL as the **physical shape constraint** and primary source of truth.
  - Do not assume any additional `ztd` directories exist unless a human explicitly creates them.
  - Generate repository SQL consistent with DDL and the documented behavior.
  - Regenerate fixtures and tests as instructed.
  - Never modify `ztd/AGENTS.md` or `ztd/README.md` unless explicitly asked.

AI decides “how to implement” within those constraints.

---

# ZTD CLI Responsibilities

ZTD CLI:

- Parses DDL files to build accurate table/column shapes.
- Rewrites SQL and exposes fixture metadata so your chosen adapter can validate statements before runtime execution.
- Generates `ztd-row-map.generated.ts`.
- Produces deterministic, parallelizable tests.

ZTD is the verification engine guaranteeing correctness.

## Traditional execution mode

- Set `ZTD_EXECUTION_MODE=traditional` or pass `{ mode: 'traditional', traditional: { isolation: 'schema', cleanup: 'drop_schema' } }` when you need to run the tests against a real Postgres schema (locking, isolation, constraints). The helper still applies the DDL inside `ztd/ddl/`, loads the fixture rows into the schema, optionally executes `setupSql`, and carries out the chosen cleanup strategy (`drop_schema`, `custom_sql`, or `none`).
- Use `isolation: 'none'` if you need to target a schema that is already defined or if your SQL embeds schema qualifiers explicitly.

---

# Summary

ZTD enables a workflow where **humans define meaning**, **AI writes implementation**, and **tests guarantee correctness**.

The project layout and workflows above ensure long-term maintainability, clarity, and full reproducibility of SQL logic independent of physical database state.

## Recommended local verification

- `npx ztd ztd-config` (Recommended)
- `pnpm -C packages/ztd-cli test` (Recommended)
- Template repository tests use stub clients by default; only adapter-backed suites require `DATABASE_URL`.
