# @rawsql-ts/cli

## Overview
@rawsql-ts/cli is the schema and entity management companion for the rawsql-ts ecosystem.  
Its mission is to streamline the **DDL → Entity → Repository → ZTD Test** development loop, making it predictable, automation‑friendly, and easy for AI assistants to navigate.

The CLI **never writes to a database**.  
It only *reads* schema definitions, generates models, and computes diffs. This ensures workflows remain aligned with **Zero Table Dependency (ZTD)**, where tests use a real Postgres engine but never touch physical tables.

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

### 1. `ddl pull`
Extract a live database schema:

```bash
rawsql-ts ddl pull --url postgres://user@host/db --out ddl/
```

- Internally calls: `pg_dump --schema-only`
- Produces stable DDL files for version control
- Never modifies the target database

### 2. `ddl gen-entities`
Generate TypeScript entity models from DDL:

```bash
rawsql-ts ddl gen-entities --ddl-dir ddl --extensions .sql --out tests/entities.ts
```

Outputs include:

- TypeScript interfaces for every table  
- A central `Entities` map  
- Column types + nullability information  
- Names stable enough for AI-driven code generation

### 3. `ddl diff`
Compare local DDL against a live database:

```bash
rawsql-ts ddl diff --ddl-dir ddl --url postgres://user@host/db --out plan.diff
```

The diff file shows:

- Added/removed tables  
- Column changes  
- Constraint differences  

Useful for migration planning and validating schema drift.

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
AI uses entities to build validation-safe ZTD tests.

### Step 5. Run ZTD tests  
Tests execute against a real Postgres engine but all CRUD queries become **fixture-backed SELECT rewrites**.

### Step 6. Fix issues and iterate  
Update DDL → regenerate entities → rerun tests.

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
   rawsql-ts parses CREATE TABLE statements into ASTs for strict interpretation.

2. **Entity generation**  
   The CLI maps SQL types → TypeScript, preserving nullability + PK semantics.

3. **Schema diff**  
   `ddl diff` normalizes SQL before comparing with pg_dump output.

4. **ZTD execution**  
   Tests using pg-testkit rewrite all writes (INSERT/UPDATE/DELETE) into safe SELECTs.

## Best Practices

- Always version-control your DDL files  
- Regenerate entity models whenever schema changes  
- Keep DDL small and modular (one file per table where possible)  
- Never import CLI code inside application runtime  
- Teach AI assistants to read from:  
  - `ddl/` → schema  
  - `tests/entities.ts` → types  

## Notes

- Postgres only (because of pg_dump)  
- Entity generation is DB-agnostic if DDL follows Postgres syntax  
- CLI and testkit are complementary but decoupled  

Using raw DDL + entity generation + ZTD testing gives you a **fully deterministic, AI-friendly development pipeline**.