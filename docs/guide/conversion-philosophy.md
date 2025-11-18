$---
title: Conversion Philosophy
outline: deep
---

# Conversion Philosophy

SQL development often follows the same pattern: build a `SELECT` to understand the rows that matter, then translate it into `INSERT`, `UPDATE`, `DELETE`, or `MERGE`. That process makes the original query vanish, leaving only the opaque mutation and the `WHERE` clause that filters it.

## Why the SELECT-first habit feels broken

1. CUD statements hide what data they actually read or write, because the read path is implicit and often spans joins, subqueries, or CTEs that become invisible once rewritten as mutation syntax.
2. Developers naturally rely on `SELECT` queries to inspect data before applying a mutation; rewriting those queries into DML destroys the readable representation and makes debugging harder.
3. When you inspect a bug, you often take the mutation, tear out the `UPDATE`/`DELETE`/`INSERT`, and rebuild a `SELECT` to observe the data. That back-and-forth is inefficient.
4. SQL compatibility issues make it tempting to keep `SELECT` queries as the truth and convert them to CUD as the final step instead of writing mutation-first code.

## How conversion helpers unlock a better workflow

- Conversion helpers let you keep the readable `SELECT` as the primary asset and generate the DML only when you need to run it, so side-effect-free observations stay in sync with the mutation semantics.
- Because the `SELECT` is the source of truth, debugging stays focused on projections and predicates, not on tracing through an opaque `UPDATE` or `MERGE` statement.
- Because the library preserves the `SELECT` as an AST, the mutation conversion is always derived from a structured representation rather than string rewriting.
- Maintaining a single `SELECT` and deriving mutations from it reduces duplication, avoids manual translation errors, and keeps the codebase aligned with tooling that operates on result rows.
- When compatibility concerns arise, you can still run the conversion helper to emit the exact `INSERT`/`UPDATE`/`DELETE`/`MERGE` flavors your platform expects while the test harness continues to work with the fixture-backed `SELECT`.

## The promise of SELECT-centric tooling

This philosophy makes the `SELECT` the canonical representation of data shape, letting you:

- Keep your test fixtures, analyzers, and debugging efforts focused on the deterministic result set rather than the mutation syntax.
- Reuse the same select-based AST for both runtime engines (`QueryBuilder`) and testing utilities (`SelectConverter`).
- Eliminate the need for dual maintenance of a `SELECT` and a matching mutation, because conversion helpers keep them in lockstep.

Ultimately, the library treats `SELECT` as the pure, observable contract and uses conversion helpers to derive the mutating operations only when needed. This also aligns testing with reality: if a mutation can be expressed as a `SELECT`, then its correctness can be validated without a database, using fixtures that describe nothing more than the data shape itself.

