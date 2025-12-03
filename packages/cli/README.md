# @rawsql-ts/cli

## Overview
@rawsql-ts/cli is the schema and entity management companion for the rawsql-ts ecosystem.  
Its mission is to streamline the **DDL -> Entity -> Repository -> ZTD Test** development loop, making it predictable, automation-friendly, and easy for AI assistants to navigate.  
The CLI is a development-time tool only and is never required at runtime.

The CLI **never writes to a database**.  
It only *reads* schema definitions, generates models, and computes diffs. This keeps workflows aligned with **Zero Table Dependency (ZTD)**, where tests use a real Postgres engine while respecting a read-only schema surface.

## Zero Table Dependency Summary
Tests execute against a real Postgres engine, but CRUD statements are rewritten into fixture-backed SELECT queries before they are sent, so no physical tables are ever read or written.  
This makes the workflow deterministic, repeatable, and safe for AI-assisted development.

## Installation

Install the CLI into your project (recommended for most users):

```bash
npm install -D @rawsql-ts/cli
```

Then run the CLI:

```bash
npx rawsql-ts
```

If you are developing inside the rawsql-ts monorepo (pnpm workspace), use:

```bash
pnpm --filter @rawsql-ts/cli exec rawsql-ts
```

`ddl pull` requires Postgres tooling such as `pg_dump` installed locally.

## Commands

### `init`

Run `rawsql-ts init` to bootstrap an interactive ZTD workspace.  
The wizard walks through two workflows, prompts for a database connection when needed, protects existing files unless you confirm, and emits the baseline artifacts listed below:

- `ddl/schema.sql`  
- `tests/entities.ts`  
- `README-ZTD.md`, `src/ZTD-GUIDE.md`, `tests/ZTD-TEST-GUIDE.md`

Each artifact serves a specific role:

- `ddl/schema.sql`: the canonical DDL that defines tables, indexes, and constraints before fixtures are generated.
- `tests/entities.ts`: the TypeScript declaration that maps every table to its row shape so repositories and AI assistants know every column and nullability rule.
- `README-ZTD.md`: a human-readable description of Zero Table Dependency and why the project chooses safe, fixture-backed tests.
- `src/ZTD-GUIDE.md`: guidance for application-layer coding that never issues migrations or direct inserts.
- `tests/ZTD-TEST-GUIDE.md`: instructions that explain how ZTD rewrites INSERT/UPDATE/DELETE into fixture-backed selects and how entity models should inform AI-generated tests.

The wizard generates `tests/entities.ts` because both AI assistants and your repository layer need a deterministic, type-safe contract for every table. Provide `ddl/` as the schema source and `tests/entities.ts` as the row-type map, and downstream tools can produce repositories, validation logic, and ZTD tests without guessing column metadata.

### 1. `ddl pull`

```bash
rawsql-ts ddl pull --url postgres://user@host/db --out ddl/
```

### 2. `ddl gen-entities`

```bash
rawsql-ts ddl gen-entities --ddl-dir ddl --extensions .sql --out tests/entities.ts
```

### 3. `ddl diff`

```bash
rawsql-ts ddl diff --ddl-dir ddl --url postgres://user@host/db --out plan.diff
```

The diff is normalized and deterministic, so `plan.diff` can safely stay in version control. It compares canonicalized DDL rather than engine-specific formatting, making reviews stable for both humans and AI.

```diff
@@ -1,3 +1,3 @@
-CREATE TABLE public.sessions (id serial PRIMARY KEY);
+CREATE TABLE public.sessions (id bigint PRIMARY KEY);
```

Track each `plan.diff` alongside your schema updates so the diff history mirrors your intended changes.

## DDL Directory Layout

Place your DDL files in the `ddl/` directory. The CLI scans this directory recursively, so you can organize tables by domain, feature, or area. `ddl/` may contain multiple `.sql` files, and nested subdirectories are picked up automatically. We recommend "one table per file" so entity generation and code review stay predictable.

## Example Generated Entities

After running `ddl gen-entities`, `tests/entities.ts` exports every table interface and an `Entities` map that AI assistants can inspect to learn row shapes:

```ts
export interface Entities {
  'public.users': PublicUsersEntity;
}

export interface PublicUsersEntity {
  id: number;
  name: string;
  created_at: string;
}
```

## Development Scenarios

## Scenario A: You already have a database

### Step 1. Pull schema
```bash
rawsql-ts ddl pull --url postgres://user@host/db --out ddl/
```

### Step 2. Generate entity models
```bash
rawsql-ts ddl gen-entities --ddl-dir ddl --out tests/entities.ts
```

### Step 3. Kick off AI-powered coding
Give your AI both:
- `ddl/*.sql`
- `tests/entities.ts`

This enables:
- repository generation  
- DTO inference  
- validation logic  
- CRUD code matching your schema

### Step 4. Ask AI to produce tests
AI uses entity interfaces to build validation-safe ZTD tests.

### Step 5. Run ZTD tests
Tests execute against a real Postgres engine but CRUD queries are rewritten into **fixture-backed SELECT rewrites**.

### Step 6. Fix issues and iterate
Update DDL -> regenerate entities -> rerun tests.

## Scenario B: No existing database (DDL-first)

### Step 1. Write DDL
Create `ddl/schema.sql` by hand.

### Step 2. Generate entity models
```bash
rawsql-ts ddl gen-entities --ddl-dir ddl --out tests/entities.ts
```

### Step 3. AI coding
Provide DDL + entities so the AI can generate repositories and domain logic.

### Step 4. AI creates ZTD tests
AI uses entity definitions to understand fixtures + expected row shapes.

### Step 5. Execute ZTD tests
Run your test suite with pg-testkit.

### Step 6. Iterate until stable
Refine schema + logic based on test failures.

## How It Works

1. **DDL parsing**  
   rawsql-ts parses `CREATE TABLE` statements into ASTs for strict interpretation.

2. **Entity generation**  
   The CLI converts SQL types into TypeScript, preserving nullability and primary-key semantics.

3. **Schema diff**  
   `ddl diff` normalizes SQL before comparing with `pg_dump` output.

4. **ZTD execution**  
   Tests using pg-testkit rewrite all writes (INSERT/UPDATE/DELETE) into safe SELECT queries.

## Best Practices

- Always version-control your DDL files.  
- Regenerate entity models whenever the schema changes.  
- Keep DDL small and modular (one file per table where possible).  
- Never import CLI code inside your application runtime.  
- Ensure AI assistants read from both `ddl/` for the schema and `tests/entities.ts` for the row types, since these two sources fully define the repository-layer contract.

## Notes

- Postgres only (because of `pg_dump`)  
- Entity generation is DB-agnostic if DDL follows Postgres syntax  
- CLI and testkit are complementary but decoupled  

This README is explicitly AI-friendly: `ddl/` and `tests/entities.ts` together describe the schema and row-type contract that downstream code should consume.
