---
title: Perf Tuning Decision Guide
outline: deep
---

# Perf Tuning Decision Guide

Use this guide when a query is already known to be performance-sensitive and the next question is whether to start with **index tuning** or **pipeline tuning**.

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
2. `perf/seed.yml` row counts large enough to approximate the intended workload.
3. A captured plan or benchmark report from `ztd perf run` so the next tuning branch is based on evidence.
4. DDL-backed schema state under `ztd/ddl/*.sql`, including any indexes that should exist in the perf sandbox.

## Choose index tuning first when

Start with index work when the captured plan shows signals such as:

- sequential scans on large relations
- joins that already have a reasonable SQL shape but still read too much data
- selective predicates that should narrow rows early

If the winning fix is an index change:

1. append the `CREATE INDEX` statement to `ztd/ddl/*.sql`
2. run `ztd perf db reset`
3. rerun `ztd perf run`

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

## DDL and index rule for perf tests

`ztd perf db reset` replays local `ztd/ddl/*.sql` into the perf sandbox.
That means performance validation should assume:

- physical tables come from DDL
- indexes also come from DDL
- rerunning `ztd perf db reset` is required after any schema or index change

If an index is missing from DDL, the perf sandbox should treat it as missing.

## Recommended loop

1. Add or confirm QuerySpec `metadata.perf`.
2. Make sure `perf/seed.yml` is not undersized for the intended workload.
3. Run `ztd perf run` and inspect the tuning guidance.
4. If the report points to indexes, update DDL and rerun `ztd perf db reset`.
5. If the report points to pipeline tuning, compare direct vs decomposed runs.
6. Save evidence once the faster branch is confirmed.