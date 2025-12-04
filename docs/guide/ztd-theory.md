# Zero Table Dependency (ZTD) - Theory Overview

Zero Table Dependency (ZTD) is a model that enables SQL to be tested as if it were a **pure function**.

## 1. Challenges of Traditional SQL Unit Testing

Conventional SQL testing faces several difficulties:

- migrations  
- seeding  
- cleaning/resetting state  
- data conflicts and non-determinism  

These make it difficult to run SQL tests quickly, deterministically, and in parallel.

ZTD eliminates all of these issues and allows SQL to be tested **with zero side effects**, similar to how pure functions are tested.

## 2. Core Idea of ZTD

ZTD can be summarized in one sentence:

> **Use a real database engine, but never read or write any physical tables.  
> (Table definitions themselves are not required.)**

Because no table is ever touched, executing SQL under ZTD produces **no side effects** of any kind.

This enables:

- deterministic tests  
- parallel execution with no conflicts  
- no migration or seeding steps  
- no cleanup  
- no shared state issues  

## 3. Technical Foundations of ZTD

ZTD is enabled by the following mechanisms.

### 3.1 CTE Shadowing

Every table reference is overridden by a CTE of the same name, fully shadowing physical tables.

Example:

```sql
with users as (
  values (1, 'alice@example.com')
)
select * from users;
```

This ensures that even if physical tables exist, they are never referenced.

### 3.2 CRUD to Result-SELECT Query  
(Purifying side-effectful operations into “result-only” SELECTs)

In ZTD, operations like INSERT / UPDATE / DELETE / MERGE—which normally carry side effects—are treated as:

> **“A query that returns the rows that *would* result from executing that operation.”**

This is a semantic reinterpretation, not an algorithmic description.

#### INSERT example (conceptual equivalence)

```sql
insert into users (email, active)
values ($1, $2)
returning id, email, active;
```

Semantically, this means:

> “Return the row that would be inserted.”

Thus, in ZTD, it is equivalent in meaning to a pure SELECT, such as:

```sql
select
  1 as id,      -- illustrative example of a new primary key
  $1 as email,
  $2 as active;
```

ZTD views CRUD not as “state-changing commands” but as  
**operations that describe row generation or transformation**.

Because they are interpreted as pure result construction,  
**tables do not need to exist at all**.

### 3.3 AST-Based Query Transformation

ZTD does *not* use regex rewriting.

Instead, a SQL parser converts incoming SQL into an AST and applies ZTD rules safely:

- detect CRUD  
- apply semantic rewriting  
- inject fixtures  
- inject CTE shadowing  
- rebuild a valid SELECT query  

This ensures preservation of:

- semantics  
- placeholders  
- structure  
- type consistency  

### 3.4 SQL Interception

ZTD intercepts queries issued by the DB driver and applies rewriting automatically.

Because rewriting happens internally:

- existing SQL does not need to be modified  
- hand-written SQL works  
- ORM-generated SQL also works  

ZTD is not a DSL—it's a transparent SQL transformation layer.

## 4. ZTD Testing Model

Under ZTD, tests never modify database state.

```
Start test → Run SQL → Evaluate result → End test (state unchanged)
```

All tests use the same fixed fixture state.

This provides:

- full determinism  
- no shared state  
- highly parallelizable tests  
- zero cleanup  
- no dependency between tests  

## 5. What ZTD Covers and What It Does Not

### ZTD *does* guarantee:

- correctness of CRUD results (RETURNING, updated rows, deleted rows)  
- type checking  
- structure and semantics of rewritten queries  
- evaluation of expressions (WHERE, SET, RETURNING, etc.)  

### ZTD does *not* attempt to cover:

- transactional consistency across multiple operations  
- multi-step stateful ETL flows  
- physical performance concerns (locks, indexes, plans, I/O)  

ZTD is focused on **unit testing SQL logic**, not simulating full database behavior.

## 6. Summary

ZTD is a new model for SQL testing that:

- treats SQL like a pure function  
- eliminates all table dependencies  
- removes side effects entirely  
- enables fast, deterministic, parallel execution  
- works with existing SQL (hand-written or ORM-generated)  
