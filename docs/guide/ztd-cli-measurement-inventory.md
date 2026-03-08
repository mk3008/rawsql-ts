---
title: ztd-cli Measurement Inventory
outline: deep
---

# ztd-cli Measurement Inventory

This guide inventories the existing timing, profiling, duration-reporting, and benchmark-specific measurement paths that currently exist around `ztd-cli`.
Its purpose is to make the OpenTelemetry migration explicit before any new instrumentation is added.

## Scope and audit rules

- The audit covers `packages/ztd-cli`, generated helper paths that `ztd-cli` scaffolds, and benchmark/test harnesses that exist specifically to exercise the ZTD flow.
- The audit does not treat generic parser microbenchmarks outside the ZTD workflow as part of the `ztd-cli` instrumentation surface.
- Classification uses four migration actions:
  - `replace with OTel`
  - `keep as local debug utility`
  - `wrap with OTel-backed implementation`
  - `remove`

## Executive summary

- `packages/ztd-cli/src` currently has no always-on timing or profiling pipeline for production CLI commands.
- The main ad-hoc measurement surface lives in generated or benchmark-only helpers, not in the command handlers themselves.
- The closest overlap with future OpenTelemetry work is the JSON event stream produced by the ZTD testkit helper (`ZTD_SQL_LOG*`, `ZTD_PROFILE*`), because it already models connection/setup/query/teardown phases.
- Benchmark runners also collect rich timing data, but those paths drive deterministic reports and should stay local instead of being turned into primary telemetry sinks.

## Inventory

| Mechanism | Location | Current behavior | Audience | Recommended migration |
| --- | --- | --- | --- | --- |
| CLI command output envelopes and diagnostics | `packages/ztd-cli/src/utils/agentCli.ts`, `packages/ztd-cli/src/commands/describe.ts`, `packages/ztd-cli/src/commands/ztdConfigCommand.ts` | Emits structured command status and diagnostics, but not timings. | User-facing automation output | `keep as local debug utility` |
| Scaffold template hook for test clients | `packages/ztd-cli/templates/tests/support/testkit-client.ts` | Placeholder only; no measurement logic is emitted by default. | User-facing scaffold entrypoint | `keep as local debug utility` |
| Generated SQL log and profile events for ZTD-backed tests | `benchmarks/sql-unit-test/tests/support/testkit-client.ts` | Emits `ztd-sql` and `ztd-profile` JSON events via `ZTD_SQL_LOG*` / `ZTD_PROFILE*`, including connection, setup, query, teardown, optional SQL text, params, and fixtures. | Internal debug utility used by tests and local diagnostics | `wrap with OTel-backed implementation` |
| Benchmark-specific ZTD metrics collector | `benchmarks/ztd-bench-vs-raw/tests/support/testkit-client.ts` | Records SQL count, DB time, rewrite time, fixture materialization, cleanup, and optional SQL/profile logs; writes worker-scoped metrics files. | Benchmark-only | `keep as local debug utility` |
| Shared benchmark phase logger | `benchmarks/support/benchmark-logger.ts` | Appends JSONL benchmark events, mirrors to console by level, and stores in-memory phase entries for report generation. | Internal benchmark/report pipeline | `keep as local debug utility` |
| Benchmark DB acquire/release timing | `benchmarks/support/db-client.ts` | Uses `process.hrtime.bigint()` to measure pool acquisition and shutdown timing; emits `acquireClient` and timeout diagnostics. | Internal benchmark/report pipeline | `keep as local debug utility` |
| End-to-end benchmark orchestration and reporting | `benchmarks/ztd-test-benchmark.ts`, `benchmarks/bench-runner/**` | Aggregates run durations, startup/execution splits, concurrency data, session stats, and Markdown/JSON reports. | Benchmark-only and report-only | `keep as local debug utility` |
| Scenario-local stage timers for benchmark scripts | `benchmarks/sql-unit-test/tests/scenarios/customerSummaryScenario.ts`, `benchmarks/sql-unit-test/scripts/customer-summary-benchmark.ts`, `benchmarks/sql-unit-test/scripts/ztd-rewrite-microbench.ts` | Uses `performance.now()` to attribute connection/query/verify/cleanup or parse/convert/stringify stage costs. | Benchmark-only | `keep as local debug utility` |

## Detailed findings

### 1. Production CLI commands are not currently timed

The command implementations under `packages/ztd-cli/src/commands` expose dry-run plans, JSON envelopes, and deterministic diagnostics, but they do not currently measure elapsed time or emit profiling spans.

Implication for OpenTelemetry:

- There is no existing command-timing system that must be replaced first.
- New OTel command spans can be introduced without having to unwind an incumbent timing API in the CLI itself.

Recommendation:

- Keep the current command envelopes and diagnostics exactly as they are.
- If command-level OTel is added later, treat it as an additive span layer, not as a replacement for stdout/stderr UX contracts.

### 2. The strongest overlap is the generated ZTD profile stream

The helper used by the benchmark-backed ZTD test flows already models the lifecycle that OTel would likely represent:

- `connection`
- `setup`
- `query`
- `teardown`

It also captures optional attributes that map naturally to span attributes or events:

- SQL text
- bind params
- fixture names
- execution mode
- query counts and total query time

Why this overlaps with OTel:

- The phase model is span-shaped already.
- The current implementation prints JSON to a sink, which is useful locally but duplicates the semantic structure a tracer would carry.
- If OTel is added independently, this path would otherwise emit two parallel representations of the same lifecycle.

Recommendation:

- Wrap this surface with an OTel-backed implementation instead of deleting it outright.
- Keep the current JSON sink as a compatibility/debug adapter that can subscribe to span lifecycle events when local troubleshooting needs raw event logs.
- Preserve the existing env-gated opt-in behavior so tests do not become noisy by default.

### 3. Benchmark metrics should stay benchmark-local

The benchmark harnesses do more than timing:

- they produce deterministic files under `tmp/`
- they aggregate worker-level metrics
- they compute report-friendly summaries such as p95 waits, total SQL counts, and startup/execution splits
- they drive Markdown reports that are meant for regression analysis

Why this should not be replaced by OTel:

- OTel is better suited for tracing/export than for repository-local benchmark report generation.
- The benchmark reports need stable, replayable file artifacts and explicit aggregation rules.
- Replacing these paths with traces would move core reporting logic into a telemetry backend concern and make local reproduction harder.

Recommendation:

- Keep benchmark loggers and metric collectors local.
- If future OTel work wants observability during benchmark runs, emit spans secondarily from these code paths rather than making OTel the source of truth for reports.

### 4. Placeholder scaffold files are not a telemetry surface yet

The default scaffolded `packages/ztd-cli/templates/tests/support/testkit-client.ts` is a placeholder that throws until users wire their own adapter.

Implication:

- There is no default measurement burden in the scaffold itself.
- OTel work should target the generated/shared helper implementations, not the placeholder.

Recommendation:

- Keep the placeholder minimal.
- Avoid adding instrumentation there unless the scaffold starts shipping a real default helper implementation.

## Overlap and conflict matrix

| Surface | Potential OTel overlap | Risk if left unchanged | Recommendation |
| --- | --- | --- | --- |
| CLI command envelopes | Low | None; different purpose | Keep |
| `ztd-profile` / `ztd-sql` helper logs | High | Duplicate lifecycle reporting once spans exist | Wrap |
| Benchmark phase logger | Medium | Confusing duplicate timing streams during benchmark runs | Keep local, optional secondary span export only |
| Benchmark metrics files and report builders | Low | Minimal; they are report artifacts, not telemetry transport | Keep |
| Scaffold placeholder | None | None | Keep |

## Proposed migration sequence

1. Add OpenTelemetry only to the generated/shared ZTD helper lifecycle first.
2. Map `connection`, `setup`, `query`, and `teardown` to spans or span events with stable attribute names.
3. Preserve the existing env-controlled JSON output as a compatibility adapter for local debugging.
4. Leave benchmark-specific reporters and file outputs unchanged until there is a concrete need for optional trace export during benchmark execution.
5. Re-evaluate whether command-level spans are useful after the helper path is instrumented, because today there is no existing timing contract to migrate there.

## Recommended ownership boundaries

- `packages/ztd-cli/src`: command UX, JSON envelopes, dry-run plans, deterministic diagnostics.
- Shared/generated helper path: best place for future runtime/test OpenTelemetry spans.
- `benchmarks/**`: remain the source of truth for reproducible performance reports and micro/macro benchmark metrics.

## Summary of recommended actions

| Mechanism class | Action |
| --- | --- |
| Command diagnostics and JSON envelopes | Keep as-is |
| Generated helper lifecycle profiling | Wrap with OTel-backed implementation |
| Benchmark phase/timing/report utilities | Keep local |
| Placeholder scaffold surfaces | Keep minimal, no OTel yet |
