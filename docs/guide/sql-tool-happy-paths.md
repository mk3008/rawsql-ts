# SQL Tool Happy Paths

This guide maps common SQL investigation questions to the shortest useful `ztd-cli` path.
Use it when the problem is not "how do I use every command?" but "which command should I run first?"

## Primary routing table

| Problem shape | Start here | Then | Avoid as the first step |
|---------------|------------|------|--------------------------|
| I need to understand how one SQL asset will split into pipeline stages | `ztd query plan <sql-file>` | `ztd perf run --dry-run ...` | Telemetry, `query uses` |
| I suspect the optimizer is confused by a predicate or CTE | `ztd query plan <sql-file>` | `ztd perf run --dry-run ...` and the perf tuning decision guide | `query uses` |
| I need to decide between index tuning and pipeline tuning for a high-volume query | `ztd query plan <sql-file>` plus QuerySpec `metadata.perf` | `ztd perf db reset --dry-run`, then `ztd perf run ...`, then direct vs decomposed comparison | Telemetry before plan or perf evidence exists |
| I need to confirm where a table or column is used before changing it | `ztd query uses <target>` | `ztd query lint <path>` | Telemetry |
| I need timing, trace export, or machine-readable execution evidence | Telemetry mode for the command under investigation | The structural command that produced the suspicious result | Starting with telemetry before the SQL shape is known |
| I need to inspect generated SQL or rewritten predicates | `ztd query plan <sql-file>` plus the focused SQL/debug workflow for the scenario | Integration or DB-backed verification | `query uses` |
| I need to add optional search filters without falling back to SQL concatenation | SSSQL truthful branches plus `optionalConditionParameters` | Focused pruning verification in unit tests | Telemetry, `query uses` |
| I need to decide whether an optional filter belongs in DynamicQueryBuilder or SSSQL | [Dynamic Filter Routing](./dynamic-filter-routing.md) | Add the focused routing dogfooding test | Guessing from prompt wording alone |

## Recommended dogfooding loop for SQL pipeline work

1. Run `ztd query plan <sql-file>` to inspect the proposed pipeline steps.
2. Run `ztd perf run --dry-run ...` to see materialization and scalar-filter candidates.
3. Reproduce the suspicious case with the smallest focused verification surface.
4. Add or update tests only after the command path tells you which stage is actually wrong.
5. Use telemetry only when the question has become about timing, export, or trace fidelity.

This order keeps structural debugging ahead of observability debugging.

## Problem-specific notes

### `query plan`

Use `query plan` when you need to answer:

- Which stages will materialize?
- Which predicates are candidates for scalar filter binding?
- In what order will the stages run?
- Which metadata choice changes the pipeline shape?

This is the default entry point for SQL pipeline dogfooding.

### `perf run --dry-run`

Use `perf run --dry-run` after `query plan` when you need recommendations rather than just structure.
It is the best follow-up when the next question is "is this rewrite likely worth doing?"

Look for:

- QuerySpec `spec_guidance` scale expectations
- `ddl_inventory` table/index counts
- `tuning_guidance.primary_path`
- `material_candidates`
- `scalar_filter_candidates`
- human-readable text hints such as `consider-scalar-filter-binding`

### `query uses`

Use `query uses` for impact analysis, not for pipeline debugging.
Good fits include:

- column rename preparation
- table split impact audit
- catalog-wide usage inventory before refactors

If the task is about runtime semantics, plan shape, or optimizer-facing SQL simplification, `query uses` is usually not the first tool.

### Telemetry

Telemetry is an opt-in branch after the structural path is known.
Use it when you need:

- command timing breakdowns
- machine-readable traces for CI or automation
- evidence that the command boundary or export path is wrong

Telemetry is intentionally not the default happy path for normal SQL dogfooding.

Saved telemetry regression scenarios live in [Telemetry Dogfooding Scenarios](../dogfooding/telemetry-dogfooding.md).

Saved SQL debug recovery scenarios live in [SQL Debug Recovery Dogfooding](../dogfooding/sql-debug-recovery.md).

Saved SSSQL optional-condition scenarios live in [SSSQL Optional-Condition Dogfooding](../dogfooding/sssql-optional-condition.md).

Saved perf scale tuning scenarios live in [Perf Scale Tuning Dogfooding](../dogfooding/perf-scale-tuning.md).

## Current saved dogfooding surfaces

The current routing now has saved regression scenarios for the following previously weak areas:

| Tool area | Saved scenario | Why it matters |
|-----------|----------------|----------------|
| Telemetry | `query uses`, `model-gen`, and `perf run --dry-run` timelines | Keeps phase attribution stable when the command result is correct but the boundary between phases is not. |
| SQL/debug flow | Long-CTE recovery loop with `query outline`, `query lint`, `query slice`, `query patch apply`, and `perf run` | Preserves the shortest command sequence that is enough to decide the next repair or tuning step. |
| SSSQL authoring | Optional-condition request -> truthful SQL branch -> explicit pruning parameters | Keeps optional-filter requests on the SQL-first path instead of regressing to string-built WHERE assembly. |
| Perf scale tuning | QuerySpec perf metadata -> DDL/index inventory -> index-vs-pipeline guidance | Keeps high-volume tuning loops explicit about whether the next step is DDL/index work or SQL decomposition. |

When a tool keeps existing but does not become the natural first step in dogfooding, add a scenario that makes its happy path unavoidable.
