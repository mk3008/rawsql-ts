# src/sql AGENTS

This directory contains SQL assets executed at runtime.

## Runtime classification

- This is a runtime directory.
- SQL files are loaded via catalog entries/executor wiring at runtime.

## Ownership (important)

- SQL expresses domain intent and is human-owned by default.
- AI may propose changes, but MUST NOT alter semantics or intent without explicit human instruction.
- If a human explicitly writes or edits SQL, the human decision always takes precedence.

## Parameter binding (required)

- SQL assets MUST use named parameters (":name" form).
- Positional parameters ("$1", "$2", ...) are forbidden in SQL assets.
- Conversion from named to indexed parameters is a runtime responsibility.

## DTO independence (critical)

- SQL MUST NOT depend on DTO shapes.
- CamelCase aliases (e.g. `as "userId"`) are forbidden.
- SQL should return database-oriented column names (typically snake_case).
- Mapping to DTOs is the responsibility of repositories or catalog runtime.

## CRUD quality bar (tables) (important)

For simple CRUD SQL under table-oriented areas:
- Prefer the most direct and idiomatic SQL.
- Do NOT encode driver limitations into SQL.
- Avoid unnecessary CTEs or counting tricks.

Examples of discouraged patterns for simple CRUD:
- `with updated as (...) select count(*) ...`
- returning values only to compute affected rows

Affected-row handling belongs to repositories/runtime, not SQL.

## CUD and RETURNING policy

- INSERT SQL MAY use `RETURNING` only for identifier columns (and optionally DB-generated columns required by contract).
- INSERT SQL MUST NOT return full rows or DTO-shaped payloads.
- UPDATE SQL MUST NOT use `RETURNING`.
- DELETE SQL MUST NOT use `RETURNING`.
- SQL MUST NOT use `RETURNING` to emulate affected-row detection (`rowCount` is the source of truth).
- If affected-row counts are unavailable from the driver/runtime, treat UPDATE/DELETE verification as unsupported at the driver boundary.

## Safety rules (critical)

- UPDATE and DELETE MUST include a WHERE clause.
- SQL MUST NOT rely on follow-up SELECTs in repositories to ensure correctness.
- A missing or incorrect WHERE clause is a SQL bug and MUST surface via tests.

## Naming conventions (recommended)

Prefer SQL-idiomatic verbs for CRUD assets:
- insert_<entity>.sql
- select_<entity>_by_<key>.sql
- select_<entities>.sql
- update_<entity>.sql
- delete_<entity>.sql

Avoid ambiguous verbs like "create" / "get" in SQL filenames by default.

## General SQL rules

- Use explicit column lists.
- Avoid `select *` unless explicitly justified.
- Prefer stable ordering when result order matters.

## Boundaries

- Do not place TypeScript code in this directory.
- Query contracts live in "src/catalog/specs".
