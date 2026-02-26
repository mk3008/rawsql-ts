---
title: Why SQL Unit Testing Is Hard and How `rawsql-ts` Solves It
outline: deep
---
# Why SQL Unit Testing Is Hard and How `rawsql-ts` Solves It

## Traditional Testing Patterns and Their Pain Points

Unit testing SQL logic is notoriously painful.
A *unit test* should verify **inputs and outputs** — yet SQL queries depend on **database state**, not explicit inputs.
Developers have tried several approaches to make SQL testable. Let’s examine them in order, from the most realistic to the most isolated.

---

### 1. Development Database Tests

This is the most common approach — running tests directly against a local or shared development database.

| Aspect       | Description                                         | Trade-off                               |
| ------------ | --------------------------------------------------- | --------------------------------------- |
| Execution    | Runs against an actual development or test database | Requires setup, teardown, and isolation |
| Verification | Tests query results under full schema fidelity      | Dependent on mutable external state     |
| Maintenance  | Mirrors production environment                      | Slow and fragile in CI environments     |

In short: **these tests resemble integration tests more than true unit tests.**

---

### 2. Query Builder & Mocked SQL Tests

To avoid the cost of a real database, many ORM or query-builder tests rely on **mocking** — verifying that a specific SQL string was generated.

| Aspect       | Description                                     | Trade-off                                              |
| ------------ | ----------------------------------------------- | ------------------------------------------------------ |
| Verification | Checks whether a given SQL string was generated | Sensitive to harmless refactors and formatting changes |
| Scope        | Focuses on SQL syntax rather than behavior      | Misses logic-level correctness                         |
| Maintenance  | Fast and isolated                               | Can break on minor library or alias changes            |

Mock-based tests validate **implementation details**, not actual behavior.
It’s like testing the **transpiled code** instead of **running the function**.

---

### 3. Repository Layer Mocks

This pattern mocks the **repository layer** — the class that encapsulates SQL access — in order to isolate upper layers (such as services or controllers) from database dependencies.
It’s **not designed to validate SQL logic itself**, but rather to isolate upper layers from database dependencies.
In other words, verifying SQL correctness is simply **outside the purpose of this pattern**.

| Aspect  | Description                                                | Trade-off                                     |
| ------- | ---------------------------------------------------------- | --------------------------------------------- |
| Purpose | Isolates service and controller logic from DB dependencies | Not intended for SQL correctness verification |
| Usage   | Mocks repository results to test upper-layer reactions     | Misleading if mistaken for SQL testing        |
| Value   | Enables fast and deterministic service tests               | Provides no insight into query behavior       |

Put simply: repository mocks are **tools for layer isolation**, rather than for SQL testing.

---

### 4. rawsql-ts: The Middle Ground

`rawsql-ts` bridges these three worlds.

| Aspect       | Description                                        | Trade-off                                              |
| ------------ | -------------------------------------------------- | ------------------------------------------------------ |
| Execution    | Runs real SQL logic on an in-memory engine         | Slightly more setup than pure mocks                    |
| Verification | Validates behavior and semantics instead of syntax | Doesn’t emulate full production engine features        |
| Maintenance  | Lightweight, schema-free, and CI-friendly          | Focused on logical correctness rather than performance |

It executes SQL directly in-memory, verifying the *behavior* of SQL code without tying tests to formatting or infrastructure.
This balance makes it ideal for true **SQL unit testing** — realistic, portable, and CI-friendly.

---

### 5. Summary

| Approach              | Validates         | Speed | Maintenance | Realism |
| --------------------- | ----------------- | ----- | ----------- | ------- |
| Development DB        | Actual results    | Slow  | High        | ✅ Full  |
| Query Builder / Mock  | SQL string        | Fast  | Low         | ❌ Low   |
| Repository Layer Mock | Application logic | Fast  | Low         | ❌ None  |
| rawsql-ts             | Query behavior    | Fast  | Low         | ✅ High  |

In practice, many teams start with **development DB tests**, then adopt **builder mocks** for speed — but both miss the sweet spot.
`rawsql-ts` exists to deliver that missing middle ground: **behavior-level SQL testing without the database baggage**.

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

## Conceptually, It's Just Dependency Injection for Databases

The same principle as DI in code applies here:

- **Traditional tests:** depend on a real DB connection (hard dependency)
- **rawsql-ts:** injects a "fixture-backed driver" (soft dependency)

This lets repositories stay unmodified while transparently swapping in a different driver for testing.

---

## Scope & Limitations

### Why Only `SELECT` Is Supported

`rawsql-ts` focuses exclusively on **read queries** (`SELECT` statements).  
There are three main reasons:

1. **Single-table CUD operations are trivial.**  
   Most `INSERT`, `UPDATE`, and `DELETE` queries are thin wrappers around ORM or driver APIs, so their correctness depends more on those layers than on SQL itself. Testing them in isolation adds little value.

2. **The real logic hides in `R` (Read) queries.**  
   `SELECT` statements encode joins, filters, computed columns, and aggregation rules - the exact areas that need deterministic verification.

3. **Modification queries stem from prior selections.**
   Any INSERT, UPDATE, or DELETE can be represented as a selection that decides which rows and which values change. Validating the read logic often implies correctness in downstream write logic.

This equivalence is not absolute - triggers, side effects, or constraints can diverge, but those concerns are implementation details, not logical ones. Focusing on SELECT keeps the validation surface tight while maximizing correctness leverage.

### What rawsql-ts Deliberately Avoids

`rawsql-ts` targets *logical correctness*, not physical performance characteristics.

Out of scope:
- Index usage
- Execution plans
- Locking / concurrency
- Vendor-specific optimizer behavior

These aspects belong to **integration / performance testing** against a real database, where the physical layer can be observed directly.

---

## AI Era: Why This Approach Matters Now

As SQL testing becomes more automated and data-driven, the testing landscape itself is evolving.
AI-generated SQL now outpaces manual review cycles, so teams need deterministic, fixture-driven tests that treat data as explicit inputs and emit diagnostics that LLMs and humans can act on.

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
| Accuracy | Can drift from production | Ensured via schema registry |
| Query validation | Manual | Automatic (AST + CTE rewrite) |

---

## In Summary

Each testing approach has value - mock-based tests remain ideal for upper layers,  
while `rawsql-ts` targets repository-level correctness with minimal friction.

Traditional SQL tests validate *how* the query was issued.  
`rawsql-ts` validates *what the query means*.

By elevating fixtures to explicit inputs and treating queries as pure functions,  
`rawsql-ts` brings SQL unit testing back to its true goal - **verifying logic, not the infrastructure plumbing**.

## Learn More

- [SchemaRegistry API](../api/interfaces/SchemaRegistry.md) - Understand how fixtures validate columns and affinities.
- [SelectQueryParser](../api/classes/SelectQueryParser.md) - Dive into the AST parser that powers fixture rewriting.

## Next Steps

- Apply the testing model in the [SQLite Testkit HowTo](./testkit-sqlite-howto.md).
- Explore the workspace demos under `packages/testkit-sqlite/demo` to see the fixture driver in practice.
