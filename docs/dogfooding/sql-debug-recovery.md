---
title: SQL Debug Recovery Dogfooding
---

# SQL Debug Recovery Dogfooding

This scenario exercises the `ztd-cli` SQL debugging loop on a deliberately broken long CTE query and verifies that the saved evidence is enough for an AI agent to decide the next action without waiting for a human.

## Goal

Restore a broken multi-CTE query, isolate the failing stage, patch the SQL safely, and measure whether the repaired direct query or a decomposed execution path is the better next step.

## When to use this scenario

Use this scenario when all of the following are true:

- The SQL file is long enough that a direct manual read is slow.
- One or more CTE stages are broken, suspicious, or too expensive to inspect inline.
- You want the next tuning step to come from evidence rather than intuition.

## Regression surface

- Test file: `packages/ztd-cli/tests/sqlDebugDogfooding.cli.test.ts`
- Test name: `sql debug recovery dogfood scenario preserves the shortest command loop artifact`

This regression surface keeps the command-level recovery path in git so future changes can verify that the saved evidence is still enough for the next action.
## Inputs

- A SQL file with a long `WITH` chain.
- Optional params in `perf/params.json` or `perf/params.yml`.
- A perf sandbox initialized through `ztd perf init`, `ztd perf db reset`, and `ztd perf seed`.

## Shortest recovery loop

1. Inspect the structure with `ztd query outline` and `ztd query graph`.
2. Use `ztd query lint` to find unused CTEs, structural risks, and likely hotspots.
3. Slice the suspicious CTE or final query with `ztd query slice`.
4. Repair the slice locally, then merge it back with `ztd query patch apply --preview`.
5. Re-run `ztd query graph` or `ztd query outline` to confirm the repaired dependency shape.
6. Compare `ztd perf run --strategy direct` with `ztd perf run --strategy decomposed --material ...`.
7. Use `ztd perf report diff` to decide whether rewrite, indexing, or materialization is the next move.

## Example walkthrough

### 1. Map the long CTE graph

```bash
ztd query outline src/sql/reports/customer_health.sql
ztd query graph src/sql/reports/customer_health.sql --format dot
ztd query lint src/sql/reports/customer_health.sql --format json
```

What this gives the AI:

- The full CTE inventory and final-query roots.
- Dependency fan-out and likely pipeline candidates.
- Early warnings such as unused CTEs, duplicate subgraphs, and analysis risks.

### 2. Isolate the broken stage

```bash
ztd query slice src/sql/reports/customer_health.sql --cte suspicious_rollup --out tmp/suspicious_rollup.sql
```

Repair `tmp/suspicious_rollup.sql`, run it independently, then apply it back:

```bash
ztd query patch apply src/sql/reports/customer_health.sql \
  --cte suspicious_rollup \
  --from tmp/suspicious_rollup.sql \
  --preview
```

If the preview looks correct, write the repaired SQL to a new file or overwrite the original.

### 3. Compare direct and decomposed execution

```bash
ztd perf run \
  --query src/sql/reports/customer_health.sql \
  --params perf/params.yml \
  --strategy direct \
  --mode auto \
  --save \
  --label before-decompose

ztd perf run \
  --query src/sql/reports/customer_health.sql \
  --params perf/params.yml \
  --strategy decomposed \
  --material suspicious_rollup,customer_rollup \
  --mode auto \
  --save \
  --label after-decompose

ztd perf report diff perf/evidence/run_001 perf/evidence/run_002
```

What this gives the AI:

- Total run metrics for the entire query path.
- Per-statement metrics and plans for each materialized stage plus the final query.
- The actual SQL that ran, not just the source SQL file.
- Evidence to answer whether the final query improved while total runtime got worse because of materialization overhead.

## What good evidence looks like

The evidence is useful when it answers these questions without another human pass:

- Which CTE stage is broken or structurally risky?
- Which SQL actually ran after params were bound or execution was decomposed?
- Did the direct query get faster, slower, or simply move the cost into a materialize step?
- Is the next action more likely to be an index, a SQL rewrite, or explicit materialization?

## Optional telemetry path

Telemetry stays opt-in, but this is one of the best dogfooding paths for it because the loop has clear phases.

```bash
ztd --telemetry --telemetry-export file --telemetry-file tmp/telemetry/perf-run.jsonl \
  perf run --query src/sql/reports/customer_health.sql --params perf/params.yml --mode auto --dry-run
```

Useful spans for this scenario:

- `perf run`
- `resolve-perf-run-options`
- `execute-perf-benchmark`
- `render-perf-report`

This lets maintainers verify that the debug loop is discoverable and that machine-facing output stays aligned with the command phases.

## Why this scenario matters

This is the shortest realistic path that exercises the current SQL debugging stack together:

- `query outline`
- `query graph`
- `query lint`
- `query slice`
- `query patch apply`
- `perf run`
- `perf report diff`

If this scenario is smooth, the core SQL debugging surface is genuinely usable for AI-assisted repair and tuning loops rather than being a set of disconnected commands.
