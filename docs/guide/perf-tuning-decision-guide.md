---
title: Perf Tuning Decision Guide
outline: deep
---

# Perf Tuning Decision Guide

Use this guide when a query is already known to be performance-sensitive and the next question is whether to start with **index tuning** or **pipeline tuning**.
The main promise of this path is that tuning stays evidence-driven and does not require breaking the SQL shape first.

## Start with QuerySpec metadata

Record the expected scale in the QuerySpec first:

```ts
metadata: {
  perf: {
    expectedScale: 'large',
    expectedInputRows: 50000,
    expectedOutputRows: 200,
  },
}
```

This does not choose the tuning branch by itself.
It marks the query as important enough that perf evidence, fixture scale, and follow-up decisions should stay explicit.

## What information must be available

A useful perf loop needs all of the following:

1. QuerySpec perf metadata so the team knows the intended scale.
2. A structural read of the query from `ztd query plan <sql-file>` before deciding whether indexes or PIPELINE are the right branch.
3. `perf/seed.yml` row counts large enough to approximate the intended workload.
4. A captured plan or benchmark report from `ztd perf run` so the next tuning branch is based on runtime evidence.
5. DDL-backed schema state under `ztd/ddl/*.sql`, including any indexes that should exist in the perf sandbox.

## Information the prompt must provide

When an AI agent or reviewer is asked to choose between index tuning and pipeline tuning, the request should include or quickly establish:

1. the QuerySpec perf declaration (`expectedScale`, and row expectations when known)
2. whether the workload issue is "too many rows scanned" or "repeated expensive intermediate work"
3. the current DDL/index state that the perf sandbox will replay
4. whether a captured plan already exists, or whether the next step must be evidence capture first

Without those inputs, the correct first response is not "add an index" or "rewrite into PIPELINE". The correct first response is to capture the missing evidence in order: `ztd query plan <sql-file>`, `ztd perf db reset --dry-run`, `ztd perf run --dry-run` or `ztd perf run`, and the local QuerySpec metadata.

## Choose index tuning first when

Start with index work when the captured plan shows signals such as:

- sequential scans on large relations
- joins that already have a reasonable SQL shape but still read too much data
- selective predicates that should narrow rows early

If the winning fix is an index change:

1. append the `CREATE INDEX` statement to `ztd/ddl/*.sql`
2. run `ztd perf db reset`
3. rerun `ztd perf run`

This path keeps SQL stable unless the evidence says the SQL itself should change.

Do not keep sandbox-only index changes outside DDL.
If the index matters for the benchmark, it must be preserved in the repository DDL.

## Choose pipeline tuning first when

Start with pipeline work when the SQL shape itself suggests repeated expensive work, for example:

- one CTE feeds multiple downstream consumers
- scalar-filter candidates appear after a large intermediate result
- a decomposed pipeline can reduce repeated fan-out or isolate a high-cardinality stage

The shortest comparison loop is:

```bash
ztd perf run --query src/sql/reports/sales.sql --strategy direct
ztd perf run --query src/sql/reports/sales.sql --strategy decomposed --material base_sales
```

Keep the same params and seed data when comparing the two runs.
The point is to tune the execution path without needing to rewrite the SQL unless the comparison shows that SQL shape is the real problem.

## DDL and index rule for perf tests

`ztd perf db reset` replays local `ztd/ddl/*.sql` into the perf sandbox.
That means performance validation should assume:

- physical tables come from DDL
- indexes also come from DDL
- rerunning `ztd perf db reset` is required after any schema or index change

If an index is missing from DDL, the perf sandbox should treat it as missing.

## Recommended loop

1. Add or confirm QuerySpec `metadata.perf`.
2. Run `ztd query plan <sql-file>` to capture the structural shape before runtime tuning.
3. Make sure `perf/seed.yml` is not undersized for the intended workload.
4. Run `ztd perf db reset --dry-run`, then `ztd perf run --dry-run` or `ztd perf run` to capture runtime evidence.
5. Reproduce the suspicious case with the smallest focused SQL/debug or integration verification surface.
6. If the report points to indexes, update DDL and rerun `ztd perf db reset`.
7. If the report points to pipeline tuning, compare direct vs decomposed runs and measure the refactor impact.
8. Save evidence once the faster branch is confirmed.
