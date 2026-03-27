---
title: Observed SQL Matching
---

# Observed SQL Matching

`ztd query match-observed` helps when you only have an observed SQL statement from logs, tracing, or a load monitor and you need to guess which `.sql` asset most likely produced it.

This workflow is intentionally different from repository telemetry:

- telemetry is for cases where `queryId` is already available
- observed SQL matching is for cases where `queryId` is missing

For the step-by-step investigation flow, read [Observed SQL Investigation](./observed-sql-investigation.md).

## When to use it

Use `ztd query match-observed` when you need to answer questions like:

- Which source asset looks most like this SQL from the database logs?
- Did the original query lose an optional filter, sort, or paging clause?
- Which query shape should I inspect first before I change application code?

It is a ranking tool, not a proof engine.

## What it compares

The initial matcher focuses on SELECT-shaped SQL and compares these structural areas:

- projection
- FROM / JOIN graph
- predicate family
- ORDER BY
- LIMIT / OFFSET presence

It ignores cosmetic differences such as whitespace, comments, and alias drift where possible.

## Good inputs

Prefer the raw observed SQL string or a file containing one observed statement:

```bash
ztd query match-observed --sql-file observed.sql
```

```bash
ztd query match-observed --sql "select u.id from users u where u.active = true"
```

Use `--format json` when you want deterministic automation output.

## Reading the result

Look for:

- the top-ranked candidates
- the score for each candidate
- why the candidate matched
- what was different

High scores mean the structural shape is close, but they do not prove semantic equivalence.

## Relationship to telemetry

If the application already emits repository telemetry with `queryId`, use telemetry first.
If the `queryId` path is missing, use observed SQL matching first and then trace back into repository code.

Telemetry is the stable path.
Observed SQL matching is the reverse lookup path.
