---
title: Select-Centered Philosophy
outline: deep
---

# Select-Centered Philosophy

At the heart of `rawsql-ts` is the belief that CRUD operations can be expressed as read queries (we call those result set `R`-queries). By translating `INSERT`, `UPDATE`, `DELETE`, and `MERGE` into `SELECT` statements, the library lets you simulate every database effect without ever touching a physical table.

## Why SELECTs become the primary surface

- `INSERT`/`UPDATE`/`DELETE`/`MERGE` statements only expose deterministic rows (the `RETURNING` clause or row count), and that payload is exactly what a `SELECT` query already describes.
- Even when a DML statement lacks `RETURNING`, its observable effect - affected rows and their projected shape - can still be captured by a deterministic `SELECT`, and complex flows such as `MERGE` are rewritten so every branch converges into a single result-set-centric query.
- If you keep fixtures aligned with those `SELECT` projections, you can reconstruct what a change would have returned or affected without actually changing state.
- A single `SELECT` path (`R`) replaces multiple execution branches so tests focus on data shapes instead of database plumbing.

## Fixtures as shadow tables via CTEs

Each converter accepts `fixtureTables` that describe column names, types, and rows. The infrastructure transforms those fixtures into CTEs that shadow the real tables referenced inside the rewritten `SELECT`. Because the converter injects those fixture CTEs ahead of the original `WITH` clause and tracks table names at the AST level, the rewritten query resolves fixtures before any physical table and alias rewrites never break the behavior. No actual schema, seeding, or cleanup is required - tests rely purely on fixture data and the read query.

## Zero physical-table dependency for CRUD

Combining the read-based converters with fixture CTEs means CRUD tests no longer touch a DBMS schema:

- You do not need to create tables before a test.
- There is no seeding step that fills real tables.
- Cleanup logic vanishes because nothing is ever written to the database.
- Transaction rollbacks become unnecessary because the fixtures already describe the final state.

DAL does not guess defaults or auto-generated values; instead, fixture tables declare the rows that the rewritten `SELECT` would return, so every NOT NULL or required-column invariant is validated purely within the read query before any driver interacts with the database.

This approach accelerates fast unit tests and makes them deterministic across environments.

## Why rawsql-ts focuses only on SELECT (and this is enough)

- `SELECT` queries are pure descriptions of data shape with no side effects, so they capture the observable payload that `INSERT`/`UPDATE`/`DELETE`/`MERGE` would expose.
- `INSERT`-based flows become literal unions when converted to `SELECT` (either via projected rows or `VALUES` tuples), while `UPDATE`/`DELETE` focus on the rows before/after the change and `MERGE` rewrites each branch into a unified result set.
- Once you can test the `SELECT` projection, you implicitly cover the correctness of the mutation because the read query already captures the joins, predicates, and required-column checks. This keeps tests fast, deterministic, and free of stateful setup.

## Learn more

- [INSERT -> SELECT Conversion](./insert-result-select.md)
- [UPDATE -> SELECT Conversion](./update-result-select.md)
- [DELETE -> SELECT Conversion](./delete-result-select.md)
- [MERGE -> SELECT Conversion](./merge-result-select.md)
- [SQLite Testkit Guide](./testkit-sqlite-howto.md)

