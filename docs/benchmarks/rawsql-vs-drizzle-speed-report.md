# rawsql-ts vs Drizzle Pure ORM Performance Report

Status: done for local Pure ORM evidence and scaffold drift-check design. Latest report date: 2026-05-03. Branch: `codex/rawsql-drizzle-benchmark`.

HTTP benchmark results are intentionally excluded from this report. The current goal is to keep the recommended `rawsql-ts RFBA + AOT generated mapper` path fast and maintainable, so the decision loop uses Pure ORM, mapper microbenchmarks, scaffold drift checks, and startup-cost measurements.

In this report, "Pure ORM" means the benchmark excludes HTTP routing, framework overhead, serialization/network transport, and app-level request handling.

The main benchmark still includes real PostgreSQL query execution because the intended question is whether the natural `DB query + mapper` path remains fast enough in practical ORM usage.

The accepted final Pure ORM result is stored under `benchmarks/drizzle-official-comparison/results-pure-orm-20260503-accepted-aot-direct-assignment`. This folder is a clarity alias for the accepted direct-assignment run, not a new measurement. The accepted final result is based on the run where generated direct-assignment aggregation was already included in the measured RFBA AOT mapper path.

## 1. Generated Mapper Drift Check Design

`generated/**` is machine-owned. The benchmark and RFBA scaffold direction only works if generated row mappers are treated as reproducible artifacts, not as files that humans or AI agents remember to refresh manually.

Current drift-check design:

| requirement | implementation |
|---|---|
| Detect SQL / contract / generated mapper mismatch | `ztd feature generated-mapper check` re-renders the expected mapper from the current scaffold source and compares it with `src/features/<feature>/queries/<query>/generated/row-mapper.ts`. |
| Fail through standard check/test/CI path | `.github/workflows/ci.yml` runs `pnpm verify:generated-mapper-drift` on the Node 20 lane. |
| Show regeneration command on failure | The ztd-cli check reports `ztd feature generated-mapper generate --feature <feature>` with an optional `--query <query>` scope. |
| Recover without editing `generated/` | `ztd feature generated-mapper generate` refreshes the machine-owned file from source artifacts. |
| Pair refresh command with passive detection | `generate` is the refresh command; `check` and `pnpm verify:generated-mapper-drift` are the passive detection path. |

The generated file also includes source hashes:

- `source-boundary-sha256`
- `source-sql-sha256`

These hashes make drift visible in the generated artifact and help reviewers see which source changed. The authoritative check is still re-rendering and comparing the generated file.

The repository-level drift script scans for scaffold-shaped `generated/row-mapper.ts` files, finds the owning package with a `ztd` script, and runs the package-local generated-mapper check. It fails if a scaffold generated mapper exists but the owning project cannot be found, because silently skipping checkable generated code would make CI drift detection unreliable.

This repository now includes `packages/ztd-cli/fixtures/generated-mapper-drift`, a real package fixture with a scaffold-shaped generated mapper. `pnpm verify:generated-mapper-drift` should therefore detect at least one target and should not skip in the normal workspace.

Skip is allowed only when the checked root contains no scaffold generated mapper artifacts at all. If checkable generated mappers exist but the script cannot locate the owning package, the check fails.

## 2. Refresh Command + Passive Detection Flow

The intended user flow is:

1. User edits hand-owned files: `query.sql`, `queryspec.ts`, contract files, or a thin `boundary.ts`.
2. Standard checks run `pnpm verify:generated-mapper-drift`.
3. If generated output is stale, the check fails and prints the regeneration command.
4. User runs the printed `ztd feature generated-mapper generate ...` command.
5. `generated/**` is recreated deterministically and can be reviewed as a machine-owned diff.

This keeps generated mapper usage passive and natural. Users do not opt into a special fast mode, and they do not hand-write mapper code. Ordinary scaffold usage is the fast path.

CI coverage:

| path | purpose |
|---|---|
| `pnpm verify:generated-mapper-drift` | Passive repository-level drift detection. |
| `pnpm --filter @rawsql-ts/ztd-cli test -- featureScaffold.unit.test.ts cliCommands.test.ts` | Verifies scaffold output shape, generated mapper commands, and command behavior. |
| `pnpm --filter @rawsql-ts/ztd-cli build` | Verifies ztd-cli TypeScript build after generator changes. |

## 3. hasMany Generation Scope

The direct-assignment aggregation improvement is accepted, but full `hasMany` / one-to-many generation should be treated as the next feature stage. It should start with a safe, metadata-backed subset rather than a broad inference engine.

Recommended first supported scope:

| area | first scope |
|---|---|
| root shape | One root object with a stable parent key. |
| relation shape | One collection relation from flat joined rows. |
| metadata source | Explicit sql-contract / queryspec metadata, not alias guessing alone. |
| parent identity | Parent key column or columns must be declared. |
| child presence | Child key/nullability guard must be declared so outer joins can skip absent children. |
| result order | Preserve SQL row order and child order unless metadata says otherwise. |
| mapping style | Generated direct assignment, no object spread in the hot row loop. |
| boundary impact | Keep `boundary.ts` thin; aggregation details stay in query-local generated/internal code. |

The current generator reads `*GeneratedMapperMetadata` by extracting the object literal and passing it to `JSON.parse`. That means the parsed object literal must be JSON-compatible: quoted keys and string values, no comments, no trailing commas, no spreads, no computed values, and no TypeScript identifiers inside the object. Type annotations or `satisfies` clauses outside the object are fine. Generated composite root keys use typed, length-prefixed segments rather than delimiter-only joins, so delimiter characters inside key values do not collide.

Out of initial scope:

- arbitrary deep object graphs
- many-to-many graph materialization
- polymorphic relations
- implicit relation discovery from column prefixes alone
- PostgreSQL JSON aggregation as the standard RFBA mapper path
- user-authored custom mapper code inside `generated/**`

The feature should preserve the current design goal: scaffolded RFBA code should be fast by default, but the public surface should stay readable.

## 4. Startup Parse Cost Benchmark

Pure ORM steady-state benchmarks do not include SQL parsing in the hot path. Startup cost is measured separately to decide whether no-parse/static SQL options are worth designing for queries without dynamic search conditions.

Command used in the materialized benchmark:

```sh
pnpm bench:startup-cost -- --runs=20 --folder=results-startup-cost-20260503
```

Artifact:

- `benchmarks/drizzle-official-comparison/results-startup-cost-20260503/startup-cost-summary.json`

Measured phases:

| phase | runs | mean | p50 | p95 | min | max |
|---|---:|---:|---:|---:|---:|---:|
| SQL file load | 20 | 0.5299ms | 0.4854ms | 0.7122ms | 0.4640ms | 0.7446ms |
| rawsql parser import | 20 | 0.5927ms | 0.4354ms | 0.6634ms | 0.4043ms | 3.1543ms |
| SQL parse | 20 | 1.9829ms | 0.9597ms | 3.6801ms | 0.7747ms | 15.8635ms |
| catalog preparation | 20 | 3.1275ms | 2.5951ms | 6.2019ms | 2.0066ms | 6.3999ms |
| generated mapper import | 20 | 1.9104ms | 1.2311ms | 3.7804ms | 0.9332ms | 4.6435ms |

Interpretation:

- Startup parser and catalog work is visible, but it is outside the steady-state request/query hot path.
- `catalog-preparation` currently includes the RFBA `loadQueryCatalog` path: parser load, SQL file load, parse, and descriptor creation.
- Dynamic search support may justify the parser at startup, but static/no-dynamic queries now have a separate measurement target for evaluating a future no-parse or precompiled descriptor option.
- Generated mapper import/load is also separate from mapper execution and should not be mixed into steady-state Pure ORM conclusions.

## 5. RFBA Scaffold Usage Impact

The performance work keeps RFBA usage natural:

- Users edit `query.sql`, `queryspec.ts`, contract files, and `boundary.ts`.
- `generated/**` remains machine-owned and reproducible.
- Generated direct-assignment mappers are the standard scaffolded internal implementation, not an advanced performance switch.
- Existing runtime mapper APIs and fallback paths remain compatible.
- `boundary.ts` remains the public surface and should not absorb SQL execution, cardinality, validation, or mapper details.

The accepted mapper optimization was intentionally placed in generation output and benchmark internals, not in a user-facing fast API. This supports the product message: ordinary RFBA scaffold usage should be fast enough without making users choose between maintainability and performance.

## 6. Accepted Pure ORM Result

Benchmark source:

- Official repository: <https://github.com/drizzle-team/drizzle-benchmarks>
- Inspected upstream commit: `2ae27415a69f00b4f0f734ebb0a98e7799008819`
- Local benchmark overlay: `benchmarks/drizzle-official-comparison`

Accepted artifact:

- `benchmarks/drizzle-official-comparison/results-pure-orm-20260503-accepted-aot-direct-assignment/pure-orm-summary.json`

Original measured folder:

- `benchmarks/drizzle-official-comparison/results-pure-orm-20260503-breakdown-baseline/pure-orm-summary.json`

The original folder name included `baseline`, but the run already included generated direct-assignment aggregation in the measured RFBA AOT path. The accepted folder was added so readers do not mistake the final accepted evidence for a pre-optimization baseline.

Command:

```sh
pnpm bench:pure-orm -- --runs=3 --iterations=2000 --warmup=100 --folder=results-pure-orm-20260503-breakdown-baseline
```

Environment:

| item | value |
|---|---|
| OS | Microsoft Windows 11 Home, OS version `10.0.26200`, build `26200`, WindowsVersion `2009`, x64-based PC |
| CPU | AMD Ryzen 7 7800X3D 8-Core Processor, 8 cores / 16 logical processors |
| CPU cache | L2 `8192 KB`, L3 `98304 KB` |
| memory | 32 GiB class; observed total physical memory `33,378,181,120` to `34,359,738,368` bytes |
| Node.js | `v22.14.0` |
| pnpm | `10.17.0` |
| PostgreSQL | `PostgreSQL 18.3 (Debian 18.3-1.pgdg13+1)` |
| PostgreSQL settings | `max_connections=300`, `shared_buffers=128MB`, `work_mem=4MB` |

Comparison strategy:

| concern | handwritten | Drizzle | rawsql-ts RFBA + AOT |
|---|---|---|---|
| SQL authoring | Human-written SQL files. | Relational query API generates SQL. | Human-owned `query.sql` remains the review target. |
| DB execution path | Direct `pg` prepared query execution. | Drizzle prepared relational query execution. | RFBA query boundary over `pg` prepared query execution. |
| Result shaping | Handwritten row-to-result mapper code. | Drizzle relational mapper path. | Generated direct-assignment row mapper. |
| Nested result strategy | JavaScript mapper/aggregation over rows. | ORM-owned relational shaping; generated SQL may move part of shaping into the database depending on the relational query path. | Ordinary row/column SQL plus generated JavaScript mapper/aggregation. |
| Hot path validation | No extra runtime validation in the measured mapper path. | This report does not establish Drizzle's validation strategy; no extra per-row validation layer is added by the benchmark. | No runtime validation in the hot mapper path; correctness is shifted left to queryspec, drift checks, and ZTD-backed DB tests. |
| Review focus | SQL and mapper are both human-owned. | Review focuses on application query code and generated SQL when inspected. | SQL, queryspec, RFBA boundary, generated mapper drift, and DB-backed query tests. |
| Maintainability trade-off | Fast and explicit, but mapper code is manually maintained. | Higher-level query authoring, with ORM-owned SQL and mapping internals. | Human-reviewable SQL with machine-owned, reproducible mapper code. |

Main result:

| phase | target | ops/sec avg | p50 avg | p95 avg | p99 avg |
|---|---|---:|---:|---:|---:|
| DB query only | handwritten direct SQL | 1,534.29 | 0.6395ms | 0.7548ms | 0.9477ms |
| DB query only | Drizzle generated SQL reference | 1,582.39 | 0.6130ms | 0.7452ms | 0.9461ms |
| DB query only | rawsql-ts RFBA SQL | 1,565.46 | 0.6212ms | 0.7612ms | 0.9544ms |
| DB query + mapper | handwritten direct SQL | 1,570.23 | 0.6084ms | 0.7663ms | 0.9759ms |
| DB query + mapper | Drizzle JIT mapper | 1,547.65 | 0.6270ms | 0.7655ms | 0.9514ms |
| DB query + mapper | rawsql-ts RFBA + AOT mapper | 1,572.09 | 0.6085ms | 0.7282ms | 0.8971ms |

Mapper and aggregation diagnostics:

These rows are diagnostics for rawsql-ts mapper and aggregation work, not an ORM ranking table.

The Drizzle `mapper-only` path is not reported here as a comparable number. In this benchmark it exercises the prepared Drizzle query path against fixture rows through the capture client, while handwritten and RFBA mapper-only rows call mapper functions directly over row arrays. That is useful as an implementation diagnostic, but the scope is not equivalent enough to claim "Drizzle mapper is slower" from this table.

| phase | target | ops/sec avg | p50 avg | note |
|---|---|---:|---:|---|
| mapper-only | handwritten | 4,481,308.12 | 0.0002ms | direct mapper function |
| mapper-only | rawsql-ts RFBA AOT mapper | 4,254,124.74 | 0.0001ms | direct generated mapper function |
| aggregation-handwritten | handwritten | 5,035,996.86 | 0.0001ms | rawsql-ts diagnostic |
| aggregation-rfba-current | old helper/spread generated shape | 550,694.42 | 0.0013ms | rawsql-ts diagnostic |
| aggregation-rfba-optimized | direct-assignment generated shape | 4,389,558.53 | 0.0002ms | rawsql-ts diagnostic |
| mapper-only | Drizzle JIT mapper path | not comparable | not comparable | fixture-query diagnostic scope differs from direct mapper function calls |

Interpretation:

- rawsql-ts RFBA + AOT is in the same local Pure ORM range as handwritten and Drizzle for the measured cases.
- The accepted direct-assignment aggregation change materially reduces generated aggregation overhead without changing public RFBA usage.
- The later `.then(...)` boundary/executor experiment was rejected because it did not improve `DB query + mapper` and made call-chain diagnostics noisier.

### Mapping and validation strategy notes

This report is not a Drizzle evaluation benchmark.
Its purpose is to check whether the recommended rawsql-ts RFBA + AOT generated mapper path can stay close to handwritten and Drizzle in the natural `DB query + mapper` path.

rawsql-ts intentionally does not use PostgreSQL JSON aggregation as the standard RFBA mapper path.

The goal is to keep SQL reviewable as ordinary row/column SQL so query behavior, joins, filtering, and cardinality remain visible during review and debugging.

Response-shape construction is intentionally kept outside the SQL layer unless a feature explicitly requires DB-side JSON shaping.

ORM relational query paths may choose different result-shaping strategies, including DB-side shaping.
Those are valid engineering trade-offs, but they change maintainability, reviewability, and debugging characteristics.

rawsql-ts also intentionally avoids runtime validation in the hot mapper path.

Correctness is shifted left through:

- queryspec contracts
- generated mapper drift checks
- ZTD-backed SQL unit tests against a real database

The intended trust boundary is different from arbitrary web input validation.
Database rows are already constrained by schema, SQL contracts, and DB-backed verification before the mapper executes.

This report does not establish Drizzle's validation strategy.
The benchmark path does not add an extra per-row Zod-style validation layer around Drizzle results.
That is not inherently unsafe; an application can rely on schema definitions plus integration or E2E coverage.
The trade-off is coverage cost: E2E tests can prove the important application paths, but they are usually broader and more expensive than focused DB-backed query tests, so edge-case mapping drift can be easier to miss without additional targeted coverage.

With that strategy, rawsql-ts RFBA + AOT generated mapper remains in the same local Pure ORM performance range as handwritten mapping.

The benchmark evidence suggests that maintainable row/column SQL plus generated direct-assignment mappers can stay competitive without requiring PostgreSQL JSON aggregation or runtime validation in the hot mapping path.

## 7. Remaining Work

Recommended next work:

| priority | item | purpose |
|---:|---|---|
| 1 | Add DB-backed fixtures for generated `hasMany` output | Fixture-row behavior is covered; DB-backed ZTD cases can prove the same shape through a query boundary. |
| 2 | Expand startup-cost benchmark cases | Compare static/no-dynamic queries against dynamic-condition-capable catalog loading. |
| 3 | Investigate query-local call-chain cost | Reduce generated/internal indirection only if Pure ORM shows a measurable benefit and `boundary.ts` remains thin. |
| 4 | Keep HTTP benchmark as secondary evidence | Use it only after Pure ORM work to confirm app-level regression risk, not to decide ORM optimization direction. |

## Artifacts

- `benchmarks/drizzle-official-comparison/scripts/pure-orm-benchmark.ts`
- `benchmarks/drizzle-official-comparison/scripts/startup-cost-benchmark.ts`
- `benchmarks/drizzle-official-comparison/results-pure-orm-20260503-accepted-aot-direct-assignment/pure-orm-summary.json`
- `benchmarks/drizzle-official-comparison/results-pure-orm-20260503-breakdown-baseline/pure-orm-summary.json`
- `benchmarks/drizzle-official-comparison/results-pure-orm-20260503-chain-after/pure-orm-summary.json`
- `benchmarks/drizzle-official-comparison/results-startup-cost-20260503/startup-cost-summary.json`
- `scripts/check-generated-mapper-drift.mjs`
- `packages/ztd-cli/fixtures/generated-mapper-drift`
- `packages/ztd-cli/src/commands/feature.ts`
- `packages/ztd-cli/tests/featureScaffold.unit.test.ts`
