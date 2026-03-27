---
title: Observed SQL Investigation
---

# Observed SQL Investigation

Use `ztd query match-observed` when you have an observed SQL statement from logs, tracing, or a load monitor and you need to rank the most likely `.sql` asset.

This guide is the reverse-lookup path for cases where `queryId` is missing.

## When to use it

Use this workflow when you need to answer questions like:

- Which source asset most likely produced this SQL?
- Did the original query lose an optional filter, paging clause, or sort?
- Which query shape should I inspect before I change application code?

It is a ranking tool, not a proof engine.

## How to run it

Start with a file if you already captured the observed SQL:

```bash
ztd query match-observed --sql-file observed.sql --format json
```

Or pass a short observed statement directly:

```bash
ztd query match-observed --sql "select u.id from users u where u.active = true"
```

Use `--format json` when you want deterministic automation output. Use the text output when you are reading the results by hand.

## What it compares

The initial matcher focuses on SELECT-shaped SQL and compares structural areas:

- projection
- FROM / JOIN graph
- predicate family
- ORDER BY
- LIMIT / OFFSET presence

It ignores whitespace, comments, and alias drift where possible.

## Reading the result

Look for:

- the top-ranked candidates
- the score for each candidate
- the main reasons it matched
- the major differences that remain

The top score tells you which asset to inspect first. It does not prove semantic equivalence.

## Typical investigation flow

1. Capture the observed SQL from your log source.
2. Run `ztd query match-observed`.
3. Inspect the highest-ranked `.sql` asset.
4. Compare the candidate against the observed statement.
5. If the statement came from a repository method, add or refine `queryId` telemetry so the next investigation can start from the stable key instead.

## When `queryId` is missing

Use this command first when you only have a DB log or tracing sample.
Once you find the most likely source asset, go back to the repository telemetry setup guide and add `queryId` to the runtime event.

