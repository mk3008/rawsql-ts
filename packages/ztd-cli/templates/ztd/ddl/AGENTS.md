# ztd/ddl AGENTS

This folder contains physical schema definitions (DDL). Human-led.

## Ownership

- Humans own DDL semantics.
- AI may assist with mechanical edits, but must not invent domain rules.

## Conventions (Postgres-oriented)

- Table names: singular (example: "user", "order", "invoice")
- Primary key: "serial8" (bigserial) by default
- Timestamps: default "current_timestamp" where applicable

## Comments (required)

Add comments for tables and important columns.

Postgres syntax:
- "comment on table <schema>.<table> is '...';"
- "comment on column <schema>.<table>.<column> is '...';"

## Constraints

- Prefer explicit NOT NULL where appropriate.
- Prefer explicit unique constraints for business keys.
- Foreign keys are allowed, but keep them intentional and explain rationale in comments.

## File strategy

- Keep schema DDL in a clear and reviewable form.
- If using one file per schema (example: "public.sql"), keep it consistent.
- Avoid random splitting unless there is a strong reason.
