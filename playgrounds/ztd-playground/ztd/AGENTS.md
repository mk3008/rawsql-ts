# AGENTS: Zero Table Dependency Definitions

## DDL Specifications

You are an AI assistant responsible for reading and respecting the contents of this /ztd/ddl directory.

### Purpose

This directory contains all canonical definitions of database structure, including CREATE TABLE, ALTER TABLE, constraints, and indexes. It is considered the **single source of truth** for database schema as interpreted by the ztd-cli.

### Behavior Rules

- **Never modify files in this folder unless explicitly instructed by a human.**
- You may propose edits, reviews, or new DDL structures when asked, but you must preserve all human-authored structure, naming, and intent.
- All DDL statements **must be semicolon-terminated** and valid PostgreSQL syntax.
- You must not reorder statements arbitrarily; semantic meaning and dependency order must be preserved.
- Respect formatting conventions, identifier styles, and comments written by humans.
- When generating new tables or columns, infer types and constraints based on other schema examples or enums (if available).
- Maintain consistency in column ordering, naming style, and constraint patterns.
- When adding to existing definitions, do not remove human-authored comments unless told to.
- Do not introduce structural changes that conflict with domain-specs or enums.

### Interaction with Other Sources

- Refer to /ztd/domain-specs for domain logic and behavioral definitions. These dictate _what_ should exist in the schema.
- Refer to /ztd/enums for allowable value sets when defining enum-like columns or constraints.
- Always use those definitions as context when writing or editing this schema.

If uncertain, defer to human authorship and request clarification.

## Domain Specifications

You are an AI agent reading this directory to interpret domain logic.

### Instructions

- Treat each Markdown file as defining **one domain behavior**.
- Use the embedded SQL block (`sql ... `) as the **reference SELECT**.
- Only the first top-level SELECT block should be considered executable logic.
- Parameters may be written in :named format (e.g., :as_of). You must bind them as positional placeholders (e.g., $1, $2, ?) in generated code.
- Do not generate or modify files in this directory unless explicitly asked.

### Assumptions

- `ztd-config` parses only DDL (`ztd/ddl/**/*.sql`) to generate row shapes.
- These specifications are for **humans and AI consumption** (documentation + reference SQL).
- Comments and descriptions exist to help you interpret logic correctly.

### Rules

- Never ignore the human-written description above the SQL block.
- Keep exactly one executable SQL block per file (one file = one behavior).
- Do not reorder or optimize the SQL unless explicitly instructed.
- Preserve the semantic meaning as given in the specification.
- This folder defines **what** logic means. Your job is to reproduce that logic elsewhere (e.g., in src/ or tests).

If in doubt, ask for clarification or defer to human judgment.

## Domain Enums

You are an AI assistant responsible for reading domain enum definitions from this folder.

### Purpose

This directory defines canonical value sets (enums) such as status codes and plan tiers. These definitions inform your code generation logic, constraint enforcement, and vocabulary use.

### Behavior Guidelines

- Read from the Markdown file containing SQL select ... from (values ...) blocks.
- Never invent magic numbers or enum values. Always use those explicitly defined here.
- Do not modify or append new enums unless explicitly instructed by a human.

### SQL Rules

- Each SQL block defines an enum set.
- Keep exactly one executable SQL block per file (one file = one enum set).
- All blocks follow the form:

`sql
select v.*
from (
  values
    (1, 'some_code', 'some_label')
) v(key, value, display_name);
`

- You must extract key and value pairs as the authoritative mapping.
- display_name,
  ranking, or other metadata may be used where helpful (e.g., UI rendering or sorting).

### Use in Code Generation

- Use these enums when generating SQL WHERE clauses, conditionals, or constants.
- When translating logic from /ztd/domain-specs, map references like :status\_\_established to corresponding values here.
- Maintain full consistency with enum names and intent.

If a required enum is missing, raise an error or ask for human clarification.
