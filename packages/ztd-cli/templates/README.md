# Zero Table Dependency Project

This project organizes all SQL‑related artifacts under the `ztd/` directory, separating concerns so both humans and AI can collaborate effectively without interfering with each other's responsibilities.

```
/ztd
  /ddl
    *.sql            <- schema definitions (required)
  /domain-specs
    *.md             <- optional behavioral notes (informational)
  /enums
    *.md             <- optional canonical value sets (informational)
  README.md          <- documentation for the layout
  AGENTS.md          <- combined guidance for people and agents

/src                 <- application & repository code
/tests               <- ZTD tests, fixtures, generated maps
```

Only the schema definitions under `ztd/ddl/` are treated as authoritative; the other directories exist only to document optional quality-of-life references.

## Generated files (important)

`tests/generated/` is auto-generated and must never be committed to git.
After cloning the repository (or in a clean environment), run (strongly recommended):

```bash
npx ztd ztd-config
```

If TypeScript reports missing modules or type errors because `tests/generated/` is missing, rerun `npx ztd ztd-config`.

`tests/generated/ztd-layout.generated.ts` declares the directories above so the CLI and your tests always point at the intended files. The directories `ztd/domain-specs/` and `ztd/enums/` are optional and MUST NOT be treated as inputs or constraints; only `ztd/ddl/` is authoritative and you should not read those directories unless a human explicitly instructs you to.

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

# Mapper + writer sample

- This scaffold already exposes `src/repositories/user-accounts.ts`, which maps `public.user_account` rows together with optional `public.user_profile` data through `@rawsql-ts/mapper-core` and emits insert/update/remove helpers via `@rawsql-ts/writer-core`.
- The SQL used here is defined in `src/repositories/user-accounts.ts`; the template tests exercise that implementation and domain-specs/enums are neither required nor authoritative unless a human asks you to consult them.
- Two template tests demonstrate how to run the stitch:
  - `tests/user-profiles.test.ts` seeds fixtures, executes the query through the mapper, and verifies the DTO shape.
  - `tests/writer-constraints.test.ts` reads `userAccountWriterColumnSets` plus `tests/generated/ztd-row-map.generated.ts` so writer callers stay within the approved column set when referencing `public.user_account`.
- Regenerate `tests/generated/ztd-row-map.generated.ts` (`npx ztd ztd-config`) before running the example tests so the row map reflects any schema changes.
- The example tests require a real PostgreSQL connection via `DATABASE_URL`; they automatically skip when the variable is missing so local tooling stays fast.

# Principles

### 1. Humans own the *definitions*
- DDL (physical schema)
- Optional reference notes (`ztd/domain-specs`, `ztd/enums`), which exist only for human documentation and are never required inputs

### 2. AI owns the *implementation*
- Repository SQL generation
- Test fixture updates
- Intermediate TypeScript structures
- SQL rewriting, parameter binding, shape resolution

### 3. ZTD ensures these stay in sync
ZTD acts as the consistency layer ensuring:
- DDL → SQL shape consistency
- Optional references remain aligned when maintained, but they are never required for AI workflows

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
3. If the query contradicts DDL, reconcile the authoritative definition before continuing (do not treat domain-specs/enums as inputs).
4. Run ZTD tests to confirm logic is consistent.
5. Regenerate ZTD config if result shapes changed.

**Flow:**  
**repository interface -> SQL -> tests (update optional docs when they exist)**

---

# Workflow C — Starting From *Repository SQL Logic Changes*  
(Fixing a bug, optimizing logic, rewriting a query)

1. Edit SQL inside the repository.
2. Run existing ZTD tests.
3. If the intended behavior changes, update the DDL before adjusting dependent logic; update optional reference notes only when explicitly instructed to keep them in sync.
4. Update fixtures if necessary.
5. If SQL result shape changed, run:

   ```bash
   npx ztd ztd-config
   ```

**Flow:**  
**SQL -> fixtures/tests (update optional docs when they exist)**

---

# Workflow D — Updating optional reference notes  
(When informational docs describing behavior change)

These reference files are human-edited documentation of existing behavior; they are not required for the CLI, the AI must not consult them unless asked, and they must never be treated as inputs or constraints.

## Optional enum documentation

1. Update the relevant `.md` file under `ztd/enums/`, if it exists.
2. Regenerate the row map so the type information stays current:

   ```bash
   npx ztd ztd-config
   ```

3. Update SQL that depends on the enum values.
4. Refresh tests and fixtures as needed, keeping `tests/writer-constraints.test.ts` and other validation logic passing.

## Optional domain-spec notes

1. Modify the `.md` spec in `ztd/domain-specs/` (when the file exists).
2. Update repository SQL and tests so the documented behavior matches reality.
3. Regenerate fixtures and row maps (via `npx ztd ztd-config`) when shapes change.
4. Touch DDL only if the behavior change requires schema updates.

**Flow:**  
**reference docs (when present) -> SQL/tests -> (DDL if required)**

---

# Combined Real‑World Flow Examples

- **Add a new contract status**  
  DDL (and optional enum documentation) -> SQL -> config -> tests

- **Add a new table**  
  DDL -> config -> SQL -> fixtures -> tests

- **Fix business logic**  
  SQL -> tests (update optional documentation if it exists)

ZTD ensures all changes converge into the same consistency pipeline.

---

# Human Responsibilities

- Humans maintain:

- Physical schema (`ddl`)
- Optional reference documents (`ztd/domain-specs`, `ztd/enums`) when they are needed for documentation
- High‑level repository interfaces
- Acceptance of AI-generated changes

Humans decide “what is correct.”

---

# AI Responsibilities

AI must:

- Use DDL as the **physical shape constraint** and primary source of truth.
- Do not consult optional reference notes (`ztd/domain-specs`, `ztd/enums`) unless explicitly instructed; treat them only as documentation and never as authoritative inputs.
- Generate repository SQL consistent with DDL and the documented behavior.
- Regenerate fixtures and tests as instructed.
- Never modify `ztd/AGENTS.md` or `ztd/README.md` unless explicitly asked.

AI decides “how to implement” within those constraints.

---

# ZTD CLI Responsibilities

ZTD CLI:

- Parses DDL files to build accurate table/column shapes
- Rewrites SQL with fixture-based CTE shadowing (via testkit adapters)
- Generates `ztd-row-map.generated.ts`
- Produces deterministic, parallelizable tests

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
- `templates/tests/user-profiles.test.ts` runs only when `DATABASE_URL` is configured; otherwise it skips automatically.
