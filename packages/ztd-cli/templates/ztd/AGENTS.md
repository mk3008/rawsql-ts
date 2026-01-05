# AGENTS: Zero Table Dependency Definitions

This file defines **protected, human-led domains** under the `ztd/` directory.
AI must treat these directories as authoritative sources of truth and must not modify them without explicit instruction.

---

## Generated files (important)

- `tests/generated/` is auto-generated and must never be committed.
- After cloning the repository (or in a clean environment), run `npx ztd ztd-config`.
- If TypeScript reports missing modules or type errors because `tests/generated/` is missing, run `npx ztd ztd-config`.

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
- Do not introduce schema changes that conflict with:
  - `ztd/domain-specs`
  - `ztd/enums`

If there is uncertainty, stop and request clarification instead of guessing.

---

## Domain Specifications (`ztd/domain-specs/`)

You are an AI agent that **reads** domain specifications to understand business semantics.

### Purpose

Each file in this directory defines **one domain behavior**.
These files explain *what the data means*, not how the application is implemented.

### Instructions

- Treat each Markdown file as defining exactly **one behavior**.
- Use the embedded SQL block as the **reference SELECT**.
- Only the first top-level SQL block is executable logic.
- Parameters may be written as `:named` placeholders.
  - When generating executable SQL, bind them as positional placeholders (`$1`, `$2`, `?`).
- **Never modify files in this directory unless explicitly instructed.**

### Rules (strict)

- Never ignore the human-written explanation above the SQL block.
- Keep exactly one executable SQL block per file.
- Do not reorder, optimize, or “simplify” SQL unless explicitly instructed.
- Preserve the exact semantics described by humans.
- This directory defines **what is correct behavior**.
  - Your role is to reproduce that behavior elsewhere (`src/`, `tests/`), not reinterpret it.

If meaning is ambiguous, defer to human judgment and ask.

---

## Domain Enums (`ztd/enums/`)

You are an AI assistant responsible for **reading and using** domain enum definitions.

### Purpose

This directory defines canonical value sets such as:

- Status codes
- Category types
- Plan tiers

These enums are the **only allowed vocabulary** for such concepts.

### Behavior Guidelines (strict)

- Never invent enum values.
- Never hardcode magic numbers or strings.
- Never modify or add enum definitions unless explicitly instructed by a human.

### SQL Rules

- Each file contains exactly one executable SQL block.
- Enum definitions follow this canonical pattern:

```sql
select v.*
from (
  values
    (1, 'some_code', 'some_label')
) v(key, value, display_name);
```

- `key` and `value` are authoritative.
- Additional columns (e.g. `display_name`, `ranking`) may be used for:
  - UI display
  - Sorting
  - Documentation

### Use in Code Generation

- Always reference enums when generating:
  - SQL WHERE conditions
  - Constants
  - Conditional logic
- When translating logic from `ztd/domain-specs`, resolve enum references through this directory.
- Maintain full consistency with naming and intent.

If a required enum does not exist, stop and ask for human clarification.

---

## Absolute Restrictions (important)

- AI must not modify anything under `ztd/` by default.
- DDL, domain-specs, and enums are **human-led artifacts**.
- AI may assist by:
  - Reading
  - Explaining
  - Proposing diffs
- AI may apply changes **only** with explicit instruction.

Violation of these rules leads to silent corruption of domain meaning and is unacceptable.
