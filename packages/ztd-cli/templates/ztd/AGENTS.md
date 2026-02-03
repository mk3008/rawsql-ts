# AGENTS: Zero Table Dependency Definitions

This file defines **protected, human-led domains** under the `ztd/` directory.
AI must treat these directories as authoritative sources of truth and must not modify them without explicit instruction.
These rules govern the `ztd/` contents after project initialization and apply regardless of mapper, writer, or runtime architecture decisions.

---

## Generated files (important)

- `tests/generated/` is auto-generated and must never be committed.
- After cloning the repository (or in a clean environment), run `npx ztd ztd-config`.
- If TypeScript reports missing modules or type errors because `tests/generated/` is missing, run `npx ztd ztd-config`.
- Generated artifacts exist solely to support validation and testing and MUST NEVER influence definitions under `ztd/`.

---

## DDL Specifications (`ztd/ddl/`)

You are an AI assistant responsible for **reading and respecting** the contents of this directory.

### Purpose

This directory contains all canonical definitions of database structure, including:

- CREATE TABLE
- ALTER TABLE
- Constraints
- Indexes

It is the **single source of truth** for the physical database schema as interpreted by ztd-cli.

### Behavior Rules (strict)

- **Never modify files in this directory unless explicitly instructed by a human.**
- Do not apply “helpful” refactors, cleanups, or formatting changes on your own.
- You may propose edits or review changes when asked, but you must not apply them without approval.
- All DDL statements must be:
  - Valid PostgreSQL syntax
  - Explicitly semicolon-terminated
- Do not reorder statements; dependency and execution order matters.
- Preserve all human-authored:
  - Naming
  - Formatting
  - Comments
  - Structural intent
- When asked to extend existing definitions:
  - Do not remove or rewrite existing columns or comments unless explicitly told.
  - Maintain column order and constraint style.
  - Do not introduce schema changes that conflict with existing constraints or indexes.
- The `public.user_account` and `public.user_profile` tables exist to support the mapper/writer sample; any modification to those tables is a maintenance obligation that requires concurrent updates to `src/repositories/views/user-profiles.ts`, `src/repositories/tables/user-accounts.ts`, and `tests/writer-constraints.test.ts` so the workflow keeps functioning.
- DDL defines physical truth only and MUST NEVER be reshaped to accommodate mapper, writer, or test tooling.
- Runtime convenience is never a valid reason to alter DDL.

If there is uncertainty, stop and request clarification instead of guessing.

---

- Only `ztd/ddl` is part of the canonical `ztd` contract; do not create or assume additional subdirectories without explicit human direction.

---

## Absolute Restrictions (important)

- AI must not modify anything under `ztd/` by default.
- DDL is the only **human-led artifact** in this directory.
- AI may assist by:
  - Reading
  - Explaining
  - Proposing diffs
- AI may apply changes **only** with explicit instruction.
- No tooling limitation, test strategy, or runtime design justifies modifying `ztd/` artifacts.

Violation of these rules leads to silent corruption of domain meaning and is unacceptable.
