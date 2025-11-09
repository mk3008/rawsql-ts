---
title: Why SQL Unit Testing Is Hard and How `rawsql-ts` Solves It
outline: deep
---

# Why SQL Unit Testing Is Hard and How `rawsql-ts` Solves It

## The Traditional Problem

Unit testing SQL logic is notoriously painful.  
A "unit test" should verify *inputs and outputs* - yet SQL queries rely on *database state* instead of explicit inputs.

Typical tests follow this pattern:

1. Create a test database.
2. Apply the schema and seed data.
3. Run the query.
4. Assert the result.
5. Clean up (truncate / rollback).

While this works, it has several downsides:

| Issue | Impact |
|-------|---------|
| Shared mutable DB state | Tests interfere with each other |
| Slow setup / teardown | Hard to run frequently |
| Schema drift | Test DB may not match production schema |
| High maintenance cost | Difficult to reproduce locally or in CI |
| Not "true" unit tests | Behavior depends on external state |

In short: **SQL tests often look like integration tests in disguise**.

---

## The RawSQL Approach

`rawsql-ts` flips this paradigm.

Instead of seeding a physical database, it rewrites intercepted `SELECT` statements into **fixture-backed CTEs** (Common Table Expressions).  
Tests define fixture rows inline, effectively turning *database state into explicit input*.

```sql
WITH "users" AS (
  SELECT 1 AS id, 'Alice' AS name, 'admin' AS role
)
SELECT * FROM users WHERE role = 'admin';
```

This makes each test a *pure function*: given certain rows (input), you get deterministic results (output).  
No file I/O, no schema migration, no cleanup required.

---

## Why This Is Better Than Mocking

Many ORM or query-builder tests rely on **SQL mocks**, verifying that a certain SQL string was issued.

| Approach | What It Verifies | Drawback |
|-----------|------------------|-----------|
| Mocking | "Was this SQL string generated?" | Tightly couples test to implementation |
| rawsql-ts | "Does this SQL return correct results?" | Independent of query syntax |

Mock-based tests fail on trivial refactors (e.g., formatting, alias renaming), even if behavior is unchanged.  
`rawsql-ts` tests actual *behavior* - not internal SQL strings - so they are far more robust.

---

## Conceptually, It's Just Dependency Injection for Databases

The same principle as DI in code applies here:

- **Traditional tests:** depend on a real DB connection (hard dependency)
- **rawsql-ts:** injects a "fixture-backed driver" (soft dependency)

This lets repositories stay unmodified while swapping in a different driver for testing.

---

## Why Only `SELECT` Is Supported

`rawsql-ts` focuses exclusively on **read queries** (`SELECT` statements`).  
There are two main reasons:

1. **Single-table CUD operations are trivial.**  
   Most `INSERT`, `UPDATE`, and `DELETE` queries are thin wrappers around ORM or driver APIs.  
   Their correctness depends more on the ORM layer than the SQL itself.  
   Testing them in isolation adds little value.

2. **The true complexity lies in `R` (Read) queries.**  
   `SELECT` statements represent the *business logic* of a repository - 
   joins, filters, computed columns, and aggregation rules.  
   These are exactly the parts that need deterministic, logic-level verification.

In other words, **`R` is where correctness matters most**, and where mocking or integration DBs fall short.  
By specializing in `SELECT`, `rawsql-ts` can ensure realistic SQL semantics and type fidelity without introducing mutation or side effects.

---

## Mock Testing Approaches in Practice

In modern projects, SQL-related tests generally fall into three categories.  
Each has its advantages, and none are inherently wrong - they just address different needs.

### 1. Query Builder Output Tests

These tests assert that an ORM or query builder produces the expected SQL string.

- **Pros:** Very fast and isolated  
- **Cons:** Test implementation details rather than behavior.  
  SQL builders or ORM libraries already guarantee correctness of generated syntax,  
  so re-testing that generation logic brings limited value.  
  Even minor library updates or formatting changes can break tests unnecessarily.

It's akin to *verifying the transpiled code instead of running the function* -  
efficient, but conceptually misaligned with the purpose of unit testing.

### 2. Repository Mocks

Here, a mock repository returns pre-defined model objects without touching the database.

- **Pros:** Excellent for testing upper layers (services, controllers).  
- **Cons:** Does **not** validate SQL correctness or query semantics.  
  It assumes the repository's SQL logic is already correct.

This pattern remains valid when your focus is purely application logic -  
and it still works alongside `rawsql-ts` if you need higher-layer isolation.

### 3. Development Database Tests

The traditional pattern: run tests against a seeded local or shared database.

- **Pros:** Real SQL execution, full schema fidelity.  
- **Cons:** Expensive to maintain. Each developer needs a local environment,  
  and CI/CD setups become heavy and fragile.  
  Scaling across multiple projects or schemas quickly becomes impractical.

### `rawsql-ts` as the Middle Ground

`rawsql-ts` bridges these approaches - executing **real SQL logic** on an in-memory engine,  
while keeping tests lightweight, portable, and deterministic.  
It brings the realism of #3 with the speed of #1, without the brittleness of mocks.

---

## Why This Approach Matters Now

Theoretically, this testing style has always been possible:  
you could intercept SQL and rewrite it with `WITH ... VALUES` manually.  
So why is it becoming relevant only now?

The short answer: **AI.**

### AI and the Need for Reliable Unit Tests

As AI-generated code grows in volume and complexity,  
human review alone cannot guarantee correctness.  
Unit tests serve as the safety net - ensuring that generated logic behaves as expected.

Expanding the *domain where unit tests are possible* has become strategically important.  
For SQL-heavy systems, `rawsql-ts` opens a previously untestable area to that safety net.

### Why It Wasn't Done Before

The obstacle was *data preparation*.  
Creating realistic test data for SQL queries has always been cumbersome -  
seeding tables, maintaining schemas, synchronizing fixtures.  
Most developers accepted the friction and skipped SQL-level unit tests altogether.

Now, with structured fixtures and schema registries, plus AI-assisted code generation,  
this barrier is gone.  
AI can easily produce fixture objects - they're just structured function inputs.

The remaining challenge is SQL comprehension:  
LLMs can misinterpret complex SQL or generate inaccurate mock data.  
That's where `rawsql-ts` steps in: by providing deterministic parsing,  
reliable fixture validation, and actionable diagnostics.

Example diagnostic output:

```
Fixture for table "users" was not provided.

Diagnostics:
  - Strategy: error
  - Table: users
  - SQL snippet: SELECT * FROM users
  - Required columns (schema registry):
      - id (INTEGER)
      - name (TEXT)
      - role (TEXT)
  - Suggested fixture template:
      {
        tableName: 'users',
        schema: {
          columns: {
            id: 'INTEGER',
            name: 'TEXT',
            role: 'TEXT'
          }
        },
        rows: [
          { id: /* INTEGER */, name: /* TEXT */, role: /* TEXT */ }
        ],
      }

Next steps:
  1. Declare a fixture for the table with the columns listed above.
  2. Provide at least one row so rewritten SELECT statements shadow the physical table.
  3. Pass fixtures via SelectRewriterOptions.fixtures or rewrite context overrides.
```

Such diagnostics make the system self-descriptive,  
allowing AI or developers to iterate rapidly without deep SQL expertise.

---

## Comparison: Before vs After

| Aspect | Traditional Dev DB Tests | rawsql-ts Fixture Tests |
|--------|---------------------------|--------------------------|
| Environment setup | Requires schema + seed | Inline fixtures |
| Speed | Seconds to minutes | Milliseconds |
| Isolation | Shared DB, risk of pollution | Fully isolated per test |
| Maintenance | Heavy | Light |
| Accuracy | Can drift from production | Schema-checked via registry |
| Query validation | Manual | Automatic (AST + CTE rewrite) |

---

## Limitations (by Design)

`rawsql-ts` focuses on *logical correctness* - not physical performance.

Out of scope:
- Index usage
- Execution plans
- Locking / concurrency
- Vendor-specific optimizer behavior

Those belong to **integration / performance testing** against a real DB.

---

## In Summary

Each testing approach has value - mock-based tests remain ideal for upper layers,  
while `rawsql-ts` targets repository-level correctness with minimal friction.

Traditional SQL tests validate *how* the query was issued.  
`rawsql-ts` validates *what the query means*.

By elevating fixtures to explicit inputs and treating queries as pure functions,  
`rawsql-ts` brings SQL unit testing back to its true goal - **verifying logic, not plumbing**.

## Learn More

- [SchemaRegistry API](../api/interfaces/SchemaRegistry.md) - Understand how fixtures validate columns and affinities.
- [SelectQueryParser](../api/classes/SelectQueryParser.md) - Dive into the AST parser that powers fixture rewriting.

## Next Steps

- Apply the testing model in the [SQLite Testkit HowTo](./sqlite-testkit-howto.md).
- Explore the workspace demos under `packages/drivers/sqlite-testkit/demo` to see the fixture driver in practice.


