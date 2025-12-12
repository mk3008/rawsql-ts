# Zero Table Dependency Project

This project organizes all SQL‑related artifacts under the `ztd/` directory, separating concerns so both humans and AI can collaborate effectively without interfering with each other's responsibilities.

```
/ztd
  /ddl
    *.sql            <- schema definitions
  /domain-specs
    *.md             <- one behavior per file (one SQL block)
  /enums
    *.md             <- one enum per file (one SQL block)
  README.md          <- documentation for the layout
  AGENTS.md          <- combined guidance for people and agents

/src                 <- application & repository code
/tests               <- ZTD tests, fixtures, generated maps
```

`tests/generated/ztd-layout.generated.ts` declares the directories above so the CLI and your tests always point at the correct files.

---

# Principles

### 1. Humans own the *definitions*
- DDL (physical schema)
- Domain specifications (business logic -> SQL semantics)
- Enums (canonical domain values)

### 2. AI owns the *implementation*
- Repository SQL generation
- Test fixture updates
- Intermediate TypeScript structures
- SQL rewriting, parameter binding, shape resolution

### 3. ZTD ensures these stay in sync
ZTD acts as the consistency layer ensuring:
- DDL ↔ SQL shape consistency
- domain-specs ↔ query logic consistency
- enums ↔ code‑level constants consistency

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
3. If the query contradicts domain-specs or enums, update specs first.
4. Run ZTD tests to confirm logic is consistent.
5. Regenerate ZTD config if result shapes changed.

**Flow:**  
**repository interface -> SQL -> (update specs if needed) -> tests**

---

# Workflow C — Starting From *Repository SQL Logic Changes*  
(Fixing a bug, optimizing logic, rewriting a query)

1. Edit SQL inside the repository.
2. Run existing ZTD tests.
3. If the intended behavior changes, update `ztd/domain-specs/`.
4. Update fixtures if necessary.
5. If SQL result shape changed, run:

   ```bash
   npx ztd ztd-config
   ```

**Flow:**  
**SQL -> domain-specs (if needed) -> fixtures/tests**

---

# Workflow D — Starting From *Enums or Domain Spec Changes*  
(Business rules change, new status added, new definition created)

## For enums:

1. Update the relevant `.md` file under `ztd/enums/`.
2. Regenerate row-map:

   ```bash
   npx ztd ztd-config
   ```

3. Update SQL referencing enum values.
4. Update domain-specs or repository SQL if behaviors change.
5. Update fixtures and tests.

## For domain-specs:

1. Modify the `.md` spec in `ztd/domain-specs/`.
2. Update SQL in `/src` to follow the new semantics.
3. Update tests and fixtures.
4. Update DDL only if the new behavior requires schema changes.

**Flow:**  
**spec/enums -> SQL -> tests -> (DDL if required)**

---

# Combined Real‑World Flow Examples

- **Add a new contract status**  
  enums -> domain-spec -> SQL -> config -> tests

- **Add a new table**  
  DDL -> config -> SQL -> fixtures -> tests

- **Fix business logic**  
  SQL -> domain-spec -> tests

ZTD ensures all changes converge into the same consistency pipeline.

---

# Human Responsibilities

Humans maintain:

- Business logic definitions (`domain-specs`)
- Physical schema (`ddl`)
- Domain vocabularies (`enums`)
- High‑level repository interfaces
- Acceptance of AI-generated changes

Humans decide “what is correct.”

---

# AI Responsibilities

AI must:

- Use domain-specs as the **semantic source of truth**
- Use enums as the **canonical vocabulary source**
- Use DDL as the **physical shape constraint**
- Generate repository SQL consistent with all three
- Regenerate fixtures and tests as instructed
- Never modify `ztd/AGENTS.md` or `ztd/README.md` unless explicitly asked

AI decides “how to implement” within those constraints.

---

# ZTD CLI Responsibilities

ZTD CLI:

- Parses DDL files to build accurate table/column shapes
- Rewrites SQL with fixture-based CTE shadowing (via testkit adapters)
- Generates `ztd-row-map.generated.ts`
- Produces deterministic, parallelizable tests

ZTD is the verification engine guaranteeing correctness.

---

# Summary

ZTD enables a workflow where **humans define meaning**, **AI writes implementation**, and **tests guarantee correctness**.

The project layout and workflows above ensure long-term maintainability, clarity, and full reproducibility of SQL logic independent of physical database state.
