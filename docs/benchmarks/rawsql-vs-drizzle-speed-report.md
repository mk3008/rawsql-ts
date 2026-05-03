# rawsql-ts vs Drizzle Speed Comparison Report

Status: done for local benchmark evidence. Main rotated run date: 2026-05-02. Repair run date: 2026-05-03. rawsql-ts: 0.20.0 / branch `codex/rawsql-drizzle-benchmark`.

## Summary

Under the local benchmark conditions recorded below, `rawsql-ts minimal` and `rawsql-ts RFBA generated` are in the same practical performance range as the Drizzle v1.0.0-rc.1 benchmark target. In this rotated run set, average throughput was:

| target | req/sec avg | req/sec median | p50 median | p95 median | p99 median | error rate |
|---|---:|---:|---:|---:|---:|---:|
| Drizzle | 5,899.90 | 6,593.96 | 21.19 ms | 456.18 ms | 481.82 ms | 0.000000% |
| handwritten | 5,246.11 | 4,759.78 | 116.70 ms | 536.74 ms | 575.12 ms | 0.000000% |
| rawsql-ts minimal | 6,035.89 | 6,555.29 | 45.63 ms | 413.29 ms | 432.00 ms | 0.000000% |
| rawsql-ts RFBA generated | 5,993.98 | 6,529.39 | 80.94 ms | 292.68 ms | 313.24 ms | 0.000018% |

The fair conclusion is comparable, with strong local variance. rawsql-ts was not meaningfully slower than Drizzle in this HTTP API workload, and the RFBA generated mapper path kept the maintainable scaffold shape within the same performance range. The handwritten direct-SQL ceiling was not consistently fastest in this local run set, which reinforces that HTTP, PostgreSQL, JSON serialization, Docker networking, and Windows host scheduling dominate enough to blur small mapper/runtime differences.

This report does not claim Drizzle is slow. It positions rawsql-ts as a SQL-first baseline implementation for comparison: keeping SQL as SQL does not necessarily impose meaningful runtime overhead.

## Method

Benchmark source:

- Official repository: <https://github.com/drizzle-team/drizzle-benchmarks>
- Inspected upstream commit: `2ae27415a69f00b4f0f734ebb0a98e7799008819`
- Official docs page: <https://orm.drizzle.team/benchmarks>

Benchmark characteristics:

- Project type: E-commerce HTTP API
- Database: PostgreSQL
- HTTP server: Hono on Node for all compared targets
- DB driver: `pg` / node-postgres for all compared Node targets
- Pool: `pg.Pool({ min: 10, max: 10 })`
- Measurement tool: official k6 scenario, run with pinned Docker image `grafana/k6:0.54.0`
- Request source: official checked-in `data/requests.json`
- Effective measured requests: the official k6 script filters out `/search-*` endpoints
- Concurrency schedule: official staged profile, ramping to 3000 VUs over a 5m40s scenario
- Runs: one warmup pass excluded from aggregation, then three measured runs per target
- Rotation: target order changes each measured pass

The inspected upstream commit has a migration/schema mismatch: `src/schema.ts` and `src/seed.ts` use `products.quantity_per_unit`, while the initial migration creates `products.qt_per_unit`. `benchmarks/drizzle-official-comparison/scripts/materialize.mjs` patches the materialized migration to `quantity_per_unit` so the official seed can run. This patch affects the shared DB schema for all targets equally and does not change seed cardinality, endpoint behavior, HTTP server, or DB driver.

rawsql-ts implementation policy:

- SQL files are loaded at startup.
- SQL parsing and query object preparation happen at startup, not per request.
- A shared `pg.Pool` is created at startup.
- Requests perform parameter coercion, prepared query execution, minimal server-side mapping, and JSON response return.
- Nested response endpoints use server-side mapping from flat joined rows. The rawsql-ts SQL does not build nested JSON in PostgreSQL with `jsonb_build_object` or `jsonb_agg`.
- `rawsql-ts minimal` is kept as a low-overhead SQL-first baseline.
- `rawsql-ts RFBA generated` follows the scaffold-style feature-first shape and moves hot DTO mapping into machine-owned `generated/row-mapper.ts` files.
- `handwritten` is the direct SQL ceiling target. It loads the same SQL files at startup, uses named prepared queries with `pg.Pool.query`, and performs direct hand-written object construction for nested DTO endpoints. It does not parse SQL and does not use rawsql-ts mapper/runtime APIs.
- The validation target is excluded from the main comparison because Drizzle does not run equivalent validation.

Measured endpoints:

| endpoint | included by k6 |
|---|---|
| `/customers` | yes |
| `/customer-by-id` | yes |
| `/search-customer` | no |
| `/employees` | yes |
| `/employee-with-recipient` | yes |
| `/suppliers` | yes |
| `/supplier-by-id` | yes |
| `/products` | yes |
| `/product-with-supplier` | yes |
| `/search-product` | no |
| `/orders-with-details` | yes |
| `/order-with-details` | yes |
| `/order-with-details-and-products` | yes |

## Environment

| item | value |
|---|---|
| OS | Microsoft Windows 11 Home 10.0.26200, 64-bit |
| CPU | AMD Ryzen 7 7800X3D 8-Core Processor, 8 cores / 16 logical processors |
| memory | 32,595,880 KiB visible to Windows |
| Node.js | v22.14.0 |
| pnpm | 10.17.0 |
| Docker | 27.3.1 |
| k6 | Docker image `grafana/k6:0.54.0` |
| PostgreSQL | 17.2, Docker `postgres` image |

Seed observed locally:

| table | rows |
|---|---:|
| employees | 200 |
| customers | 10,000 |
| orders | 50,000 |
| products | 5,000 |
| suppliers | 1,000 |
| order_details | 307,333 |

Request list observed from official `data/requests.json`:

| item | count |
|---|---:|
| total requests | 426,999 |
| requests included by official k6 filter | 371,999 |

## Commands

Materialize the benchmark overlay:

```sh
node benchmarks/drizzle-official-comparison/scripts/materialize.mjs
cd tmp/drizzle-benchmarks-rawsql
pnpm install --ignore-workspace --ignore-scripts
```

Prepare the DB:

```sh
DATABASE_URL="postgres://postgres:postgres@localhost:5435/postgres"
pnpm start:docker
pnpm start:seed
pnpm start:generate
```

Run the pinned, warmup-aware, rotated k6 suite:

```sh
pnpm bench:k6:docker:rotated -- --targets handwritten,drizzle,rawsql,rfba --runs 3 --folder results-rotated-20260502
```

The helper used this order:

| pass | measured | target order |
|---|---|---|
| warmup | no | handwritten, drizzle, rawsql, rfba |
| run-1 | yes | drizzle, rawsql, rfba, handwritten |
| run-2 | yes | rawsql, rfba, handwritten, drizzle |
| run-3 | yes | rfba, handwritten, drizzle, rawsql |

`rawsql-run-3` in the first suite was interrupted during collection and produced an invalid k6 rate (`68.95 req/sec` with 1.86M requests). It was excluded. A repair pass was run with the same pinned k6 image and its own excluded warmup:

```sh
pnpm bench:k6:docker:rotated -- --targets rawsql --runs 1 --folder results-rotated-20260503-rawsql-repair
```

The measured repair run is used as `rawsql-run-3` in the tables below.

## Results

### Warmup Runs

Warmup runs were required and excluded from aggregation.

| target | req/sec | p50 ms | p95 ms | p99 ms | failed requests |
|---|---:|---:|---:|---:|---:|
| handwritten warmup | 6,488.50 | 4.51 | 447.74 | 469.24 | 0 |
| Drizzle warmup | 4,850.87 | 59.59 | 590.32 | 618.17 | 0 |
| rawsql-ts minimal warmup | 5,533.80 | 3.39 | 561.78 | 582.33 | 0 |
| rawsql-ts RFBA generated warmup | 4,901.58 | 60.23 | 581.28 | 604.59 | 0 |
| rawsql-ts repair warmup | 4,872.67 | 57.67 | 610.61 | 637.22 | 0 |

### Three-Run Comparison

Average and median across the three measured runs:

| target | req/sec avg | req/sec median | p50 avg | p50 median | p95 avg | p95 median | p99 avg | p99 median | error rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Drizzle | 5,899.90 | 6,593.96 | 91.81 | 21.19 | 449.21 | 456.18 | 485.74 | 481.82 | 0.000000% |
| handwritten | 5,246.11 | 4,759.78 | 92.95 | 116.70 | 520.64 | 536.74 | 550.20 | 575.12 | 0.000000% |
| rawsql-ts minimal | 6,035.89 | 6,555.29 | 63.60 | 45.63 | 474.71 | 413.29 | 500.82 | 432.00 | 0.000000% |
| rawsql-ts RFBA generated | 5,993.98 | 6,529.39 | 84.67 | 80.94 | 378.16 | 292.68 | 406.58 | 313.24 | 0.000018% |

Individual measured runs:

| run | target | req/sec | p50 ms | p95 ms | p99 ms | failed requests | source |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | Drizzle | 6,593.96 | 3.60 | 456.18 | 481.82 | 0 | `results-rotated-20260502` |
| 1 | handwritten | 4,759.78 | 116.70 | 568.19 | 604.24 | 0 | `results-rotated-20260502` |
| 1 | rawsql-ts minimal | 6,555.29 | 45.63 | 413.29 | 428.57 | 0 | `results-rotated-20260502` |
| 1 | rawsql-ts RFBA generated | 6,529.39 | 72.31 | 292.68 | 313.24 | 1 | `results-rotated-20260502` |
| 2 | Drizzle | 4,058.18 | 250.63 | 597.37 | 662.53 | 0 | `results-rotated-20260502` |
| 2 | handwritten | 4,716.97 | 158.54 | 536.74 | 575.12 | 0 | `results-rotated-20260502` |
| 2 | rawsql-ts minimal | 4,652.80 | 119.96 | 606.39 | 641.89 | 0 | `results-rotated-20260502` |
| 2 | rawsql-ts RFBA generated | 4,781.11 | 100.75 | 588.19 | 623.45 | 0 | `results-rotated-20260502` |
| 3 | Drizzle | 7,047.57 | 21.19 | 294.09 | 312.88 | 0 | `results-rotated-20260502` |
| 3 | handwritten | 6,261.57 | 3.61 | 456.99 | 471.23 | 0 | `results-rotated-20260502` |
| 3 | rawsql-ts minimal | 6,899.59 | 25.20 | 404.45 | 432.00 | 0 | `results-rotated-20260503-rawsql-repair` |
| 3 | rawsql-ts RFBA generated | 6,671.44 | 80.94 | 253.62 | 283.05 | 0 | `results-rotated-20260502` |

### Endpoint Medians

The k6 script tags each request with `endpoint` and emits endpoint-specific duration Trends. This table reports the median run's endpoint p50/p95/p99 per target.

| endpoint | target | p50 median ms | p95 median ms | p99 median ms |
|---|---|---:|---:|---:|
| `/customers` | handwritten | 122.14 | 539.00 | 578.13 |
| `/customers` | Drizzle | 22.74 | 457.19 | 483.22 |
| `/customers` | rawsql-ts minimal | 47.44 | 414.75 | 434.93 |
| `/customers` | rawsql-ts RFBA generated | 83.78 | 295.65 | 315.00 |
| `/customer-by-id` | handwritten | 117.80 | 535.99 | 575.31 |
| `/customer-by-id` | Drizzle | 20.82 | 456.28 | 481.97 |
| `/customer-by-id` | rawsql-ts minimal | 45.45 | 412.97 | 431.11 |
| `/customer-by-id` | rawsql-ts RFBA generated | 80.63 | 292.06 | 312.34 |
| `/employees` | handwritten | 114.63 | 533.08 | 570.35 |
| `/employees` | Drizzle | 21.34 | 455.45 | 479.81 |
| `/employees` | rawsql-ts minimal | 46.15 | 413.07 | 431.97 |
| `/employees` | rawsql-ts RFBA generated | 82.26 | 294.08 | 313.13 |
| `/employee-with-recipient` | handwritten | 120.39 | 536.26 | 575.93 |
| `/employee-with-recipient` | Drizzle | 20.44 | 456.54 | 481.44 |
| `/employee-with-recipient` | rawsql-ts minimal | 45.53 | 413.49 | 431.28 |
| `/employee-with-recipient` | rawsql-ts RFBA generated | 80.84 | 292.57 | 313.62 |
| `/suppliers` | handwritten | 117.93 | 539.09 | 572.82 |
| `/suppliers` | Drizzle | 16.49 | 458.23 | 481.68 |
| `/suppliers` | rawsql-ts minimal | 46.02 | 413.01 | 430.75 |
| `/suppliers` | rawsql-ts RFBA generated | 81.10 | 292.58 | 311.89 |
| `/supplier-by-id` | handwritten | 115.78 | 536.27 | 574.80 |
| `/supplier-by-id` | Drizzle | 20.19 | 456.00 | 481.48 |
| `/supplier-by-id` | rawsql-ts minimal | 45.43 | 413.16 | 431.45 |
| `/supplier-by-id` | rawsql-ts RFBA generated | 80.71 | 292.51 | 313.41 |
| `/products` | handwritten | 120.19 | 538.25 | 575.27 |
| `/products` | Drizzle | 23.60 | 456.80 | 482.70 |
| `/products` | rawsql-ts minimal | 46.17 | 413.69 | 432.85 |
| `/products` | rawsql-ts RFBA generated | 82.11 | 292.95 | 313.05 |
| `/product-with-supplier` | handwritten | 116.13 | 536.55 | 574.75 |
| `/product-with-supplier` | Drizzle | 21.19 | 456.02 | 481.73 |
| `/product-with-supplier` | rawsql-ts minimal | 45.47 | 413.28 | 431.99 |
| `/product-with-supplier` | rawsql-ts RFBA generated | 80.84 | 292.51 | 313.06 |
| `/orders-with-details` | handwritten | 120.64 | 538.95 | 576.56 |
| `/orders-with-details` | Drizzle | 24.08 | 458.26 | 484.97 |
| `/orders-with-details` | rawsql-ts minimal | 48.04 | 415.86 | 436.74 |
| `/orders-with-details` | rawsql-ts RFBA generated | 83.46 | 295.89 | 317.16 |
| `/order-with-details` | handwritten | 116.84 | 536.77 | 575.41 |
| `/order-with-details` | Drizzle | 20.75 | 456.17 | 481.82 |
| `/order-with-details` | rawsql-ts minimal | 45.53 | 413.14 | 431.80 |
| `/order-with-details` | rawsql-ts RFBA generated | 80.81 | 292.56 | 312.69 |
| `/order-with-details-and-products` | handwritten | 116.49 | 536.90 | 575.15 |
| `/order-with-details-and-products` | Drizzle | 21.62 | 456.08 | 481.68 |
| `/order-with-details-and-products` | rawsql-ts minimal | 45.71 | 413.25 | 432.08 |
| `/order-with-details-and-products` | rawsql-ts RFBA generated | 80.93 | 292.75 | 313.58 |

### Mapper Profile

The mapper hot-path profile still explains why generated mappers are useful even when HTTP throughput is dominated by broader system costs.

| profile | ops/sec | relative |
|---|---:|---:|
| product-with-supplier generic mapRows | 251,637.71 | 1.00x |
| product-with-supplier compiled projector | 2,813,727.84 | 11.18x |
| product-with-supplier generated mapper | 54,016,680.35 | 214.66x |
| order-with-details-and-products generic mapRows | 37,468.59 | 1.00x |
| order-with-details-and-products compiled projector | 706,079.26 | 18.84x |
| order-with-details-and-products generated mapper | 8,886,361.21 | 237.17x |

Artifacts in the materialized benchmark workspace:

- `tmp/drizzle-benchmarks-rawsql/results-rotated-20260502/*-summary.json`
- `tmp/drizzle-benchmarks-rawsql/results-rotated-20260503-rawsql-repair/*-summary.json`
- `tmp/drizzle-benchmarks-rawsql/seed.log`

## Analysis

The four targets are close enough that single-run conclusions are unsafe. Drizzle, rawsql-ts minimal, and RFBA generated all crossed 6.5k req/sec in at least one measured run. The lowest measured full-run throughput was `drizzle-run-2` at 4,058.18 req/sec, followed by `rawsql-run-2` and `rfba-run-2` in the same run pass. This points to local scheduling, DB/container state, and request-list position effects, not a stable target ranking.

The direct handwritten target is the theoretical ceiling because it removes rawsql-ts parsing, rawsql-ts mapper/runtime APIs, Drizzle query objects, and generic contract machinery from the request path. It was not consistently fastest here. That does not mean handwritten has more abstraction overhead; it means this HTTP benchmark is dominated by shared costs: Hono routing, node-postgres pool scheduling, PostgreSQL execution, result transfer, JSON serialization, Docker networking, and Windows host scheduling under 3000 VUs.

rawsql-ts minimal does not build SQL or parse SQL per request. SQL files are loaded and parsed at startup. Request-time work is prepared query execution plus minimal mapping. The fact that rawsql-ts minimal was comparable to Drizzle, rather than dramatically faster, is consistent with Drizzle's benchmark target also being a steady-state prepared execution path where SQL construction is not the dominant cost.

RFBA generated is the main maintainability result. It keeps the scaffold-style boundary shape and machine-owned generated mappers while staying in the same throughput range as Drizzle and rawsql-ts minimal. Compared with the earlier RFBA runtime-mapper target, generated mappers remove hot-path generic key/object construction, repeated mapper lookup, and relation traversal. The mapper profile shows that this optimization is real in isolation; the HTTP benchmark shows that end-to-end gains are bounded by shared system costs.

The single RFBA failed request was:

```text
GET /order-with-details?id=41031
error="dial tcp 192.168.65.254:3000: connect: connection refused"
```

That is a connection-level refusal, not an endpoint-specific SQL, mapping, validation, or non-2xx application error. `rfba-run-2`, `rfba-run-3`, and the rawsql repair run completed with zero failed requests. The best classification is transient local server/container networking or worker availability during the run. It is still included in the reported error rate.

`rawsql-run-3` from the original rotated suite was excluded because the user interrupted the collection after the run had produced a delayed summary with an invalid rate. The count was plausible, but the k6 rate was not: `68.95 req/sec` with 1.86M requests. Keeping it would make the aggregate misleading. The replacement run used the same pinned k6 image and excluded its own warmup; the only difference is that it was a repair pass rather than the fourth slot in the original rotation.

## Conclusion

Under these local conditions, rawsql-ts can reasonably be described as comparable to Drizzle and not meaningfully slower for the measured HTTP API workload. The result is conditional on this environment, seed, endpoint mix, and pinned k6 runner.

The RFBA + sql-contract generated mapper shape is a viable standard scaffold path: it keeps the public `boundary.ts` thin, keeps generated files machine-owned, avoids request-time validation, and remains in the same practical performance range as Drizzle and rawsql-ts minimal.

The fully handwritten target should stay in the benchmark as a ceiling/reference target, but the current evidence says there is little value in chasing tiny mapper-level wins without endpoint-level profiling. The next useful work is to keep the generated mapper drift check in CI, preserve the fallback runtime mapper APIs for compatibility, and add deeper profiling only for endpoints where endpoint-tagged latency shows a stable gap.

There is value in preparing an upstream benchmark PR after documenting the materialized migration compatibility patch and the pinned k6 workflow. The framing should stay neutral: rawsql-ts demonstrates a SQL-first baseline alongside Drizzle, not an attack on Drizzle.

## Optional Validation Overhead

The validation target exists, but it is excluded from the main comparison because the Drizzle target does not add equivalent response validation. If validation is compared later, both sides should add equivalent validation and be reported separately from the minimal baseline.
