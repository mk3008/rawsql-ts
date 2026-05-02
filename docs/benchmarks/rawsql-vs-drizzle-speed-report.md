# rawsql-ts vs Drizzle Speed Comparison Report

Status: done for local benchmark evidence. Run date: 2026-05-01. rawsql-ts: 0.20.0 / commit fa5bb3dd.

## Summary

Under the local benchmark conditions recorded below, `rawsql-ts minimal` is in the same practical performance range as the Drizzle v1.0.0 benchmark target. It is not uniformly better: average throughput was slightly higher for rawsql-ts minimal, while p95/p99 tail latency was slightly worse. The fair headline for the minimal target is comparable, with no meaningful runtime disadvantage for this HTTP API workload.

The first `rawsql-ts RFBA sql-contract` target was more representative of the recommended rawsql-ts application shape, but its generic runtime mapping path was slower than both Drizzle and rawsql-ts minimal. After moving hot RFBA DTO mapping behind machine-owned `generated/row-mapper.ts` files, the standard RFBA shape stayed thin at the public boundary and moved into the same practical performance range as Drizzle and rawsql-ts minimal. The generated-mapper RFBA HTTP run averaged 5,121.76 req/sec with zero failed requests across three runs. That is a clear improvement over the initial RFBA target and a small average throughput improvement over the previous compiled-projector-optimized run, although run-to-run variance remains large.

`rawsql-ts with validation` is not included in the main comparison because the inspected Drizzle benchmark target does not add an equivalent response-validation layer. Its run data is kept only as optional overhead evidence.

This report does not claim Drizzle is slow. It positions rawsql-ts as a SQL-first baseline implementation for comparison: keeping SQL as SQL does not necessarily impose meaningful runtime overhead.

## Method

Benchmark source:

- Official repository: <https://github.com/drizzle-team/drizzle-benchmarks>
- Inspected upstream commit: `2ae27415a69f00b4f0f734ebb0a98e7799008819`
- Official docs page: <https://orm.drizzle.team/benchmarks>

Benchmark characteristics:

- Project type: E-commerce HTTP API
- Database: PostgreSQL
- HTTP server: Hono on Node
- DB driver: `pg` / node-postgres for all compared Node targets
- Pool: `pg.Pool({ min: 10, max: 10 })`
- Measurement tool: official `bench/bench.js` k6 scenario, run with Docker k6
- Request source: official checked-in `data/requests.json`
- Effective measured requests: the official k6 script filters out `/search-*` endpoints
- Concurrency schedule: official staged profile, ramping to 3000 VUs over a 5m40s scenario
- Runs: 3 per main target with p99 enabled

Compatibility note:

- The inspected upstream commit has a migration/schema mismatch: `src/schema.ts` and `src/seed.ts` use `products.quantity_per_unit`, while the initial migration creates `products.qt_per_unit`.
- `benchmarks/drizzle-official-comparison/scripts/materialize.mjs` patches the materialized migration to `quantity_per_unit` so the official seed can run.
- This patch affects the shared DB schema for Drizzle and rawsql-ts targets equally and does not change seed cardinality, endpoint behavior, HTTP server, or DB driver.

rawsql-ts implementation policy:

- SQL files are loaded at startup.
- Each SQL file is parsed at startup with `SelectQueryParser.parse`.
- A shared `pg.Pool` is created at startup.
- Requests perform parameter coercion, prepared query execution, JSON response return, and server-side mapping only.
- Nested response endpoints use server-side mapping from flat joined rows. The rawsql-ts SQL does not build nested JSON in PostgreSQL with `jsonb_build_object` or `jsonb_agg`.
- `rawsql-ts minimal` is kept as a low-overhead SQL-first baseline.
- `rawsql-ts RFBA sql-contract` is the recommended maintainable rawsql-ts shape for this benchmark: the benchmark follows the `packages/transfer` feature-first scaffold style with `adapters/pg`, `features/_shared`, and endpoint-owned `features/<feature>/boundary.ts` entrypoints.
- The optimized RFBA target uses query-local generated row mappers for hot nested DTO mappings. The previous compiled column-map projector path remains available as a compatible alternative and profile comparison point.
- For one-to-many order details, the current benchmark still composes arrays in query-local generated code after flat row projection, because first-class generated `hasMany` aggregation is still a follow-up.
- The validation target is available as an optional diagnostic only; it is excluded from the main comparison because Drizzle does not run equivalent validation.

Measured endpoints:

| endpoint | included by official k6 script |
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
| k6 | Measured with Docker image `grafana/k6:latest`, `k6 v2.0.0-rc1+dirty`; the helper now defaults to pinned `grafana/k6:0.54.0` with `K6_IMAGE` override |
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

Request list observed from the official checked-in `data/requests.json`:

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
```

Run target servers:

```sh
pnpm start:drizzle
pnpm start:rawsql
pnpm start:rawsql:rfba
```

Run k6 from Docker while a target server is listening on port 3000:

```sh
K6_IMAGE=grafana/k6:0.54.0 pnpm bench:k6:docker -- --host http://host.docker.internal:3000 --name <name> --folder results
```

Run the mapper hot-path profile:

```sh
pnpm exec tsx profiles/mapper-profile.ts
```

## Results

Average across three runs:

| target | req/sec | p50 ms | p90 ms | p95 ms | p99 ms | error rate |
|---|---:|---:|---:|---:|---:|---:|
| Drizzle | 4,856.55 | 155.75 | 501.79 | 534.57 | 562.15 | 0.000000% |
| rawsql-ts minimal | 4,930.92 | 62.79 | 589.78 | 622.19 | 649.37 | 0.000020% |
| rawsql-ts RFBA sql-contract generated | 5,121.76 | 81.47 | 472.80 | 506.36 | 526.55 | 0.000000% |
| rawsql-ts RFBA sql-contract optimized | 5,078.65 | 116.85 | 442.60 | 472.20 | 505.63 | 0.000000% |
| rawsql-ts RFBA sql-contract initial | 4,001.54 | 223.40 | 651.06 | 714.55 | 758.51 | 0.000000% |

Median run:

| target | req/sec | p50 ms | p90 ms | p95 ms | p99 ms | error rate |
|---|---:|---:|---:|---:|---:|---:|
| Drizzle | 4,598.63 | 171.20 | 589.30 | 625.77 | 660.76 | 0.000000% |
| rawsql-ts minimal | 5,036.05 | 8.46 | 589.49 | 617.70 | 645.82 | 0.000000% |
| rawsql-ts RFBA sql-contract generated | 5,206.57 | 3.87 | 488.77 | 509.10 | 526.32 | 0.000000% |
| rawsql-ts RFBA sql-contract optimized | 4,441.86 | 154.45 | 503.32 | 519.36 | 577.24 | 0.000000% |
| rawsql-ts RFBA sql-contract initial | 3,887.92 | 243.89 | 645.89 | 714.79 | 760.55 | 0.000000% |

Individual runs:

| run | target | req/sec | p50 ms | p95 ms | p99 ms | failed requests |
|---|---|---:|---:|---:|---:|---:|
| drizzle-run-2 | Drizzle | 5,577.69 | 171.20 | 336.47 | 349.62 | 0 |
| drizzle-run-3 | Drizzle | 4,598.63 | 123.19 | 625.77 | 660.76 | 0 |
| drizzle-run-4 | Drizzle | 4,393.35 | 172.85 | 641.47 | 676.08 | 0 |
| rawsql-minimal-run-1 | rawsql-ts minimal | 5,411.48 | 3.59 | 593.51 | 611.20 | 1 |
| rawsql-minimal-run-2 | rawsql-ts minimal | 4,345.24 | 176.33 | 655.37 | 691.10 | 0 |
| rawsql-minimal-run-3 | rawsql-ts minimal | 5,036.05 | 8.46 | 617.70 | 645.82 | 0 |
| rawsql-rfba-generated-run-1 | rawsql-ts RFBA sql-contract generated | 6,200.15 | 3.09 | 428.97 | 443.75 | 0 |
| rawsql-rfba-generated-run-2 | rawsql-ts RFBA sql-contract generated | 5,206.57 | 3.87 | 509.10 | 526.32 | 0 |
| rawsql-rfba-generated-run-3 | rawsql-ts RFBA sql-contract generated | 3,958.55 | 237.44 | 581.01 | 609.57 | 0 |
| rawsql-rfba-optimized-run-1 | rawsql-ts RFBA sql-contract optimized | 4,394.44 | 154.45 | 549.43 | 578.94 | 0 |
| rawsql-rfba-optimized-run-2 | rawsql-ts RFBA sql-contract optimized | 6,399.66 | 40.83 | 347.82 | 360.70 | 0 |
| rawsql-rfba-optimized-run-3 | rawsql-ts RFBA sql-contract optimized | 4,441.86 | 155.28 | 519.36 | 577.24 | 0 |
| rawsql-rfba-run-1 | rawsql-ts RFBA sql-contract | 3,887.92 | 243.89 | 733.35 | 773.13 | 0 |
| rawsql-rfba-run-2 | rawsql-ts RFBA sql-contract | 3,709.78 | 302.36 | 714.79 | 760.55 | 0 |
| rawsql-rfba-run-3 | rawsql-ts RFBA sql-contract | 4,406.93 | 123.95 | 695.52 | 741.86 | 0 |

Mapper hot-path profile:

| profile | ops/sec | relative |
|---|---:|---:|
| product-with-supplier generic mapRows | 251,637.71 | 1.00x |
| product-with-supplier compiled projector | 2,813,727.84 | 11.18x |
| product-with-supplier generated mapper | 54,016,680.35 | 214.66x |
| order-with-details-and-products generic mapRows | 37,468.59 | 1.00x |
| order-with-details-and-products compiled projector | 706,079.26 | 18.84x |
| order-with-details-and-products generated mapper | 8,886,361.21 | 237.17x |

Artifacts in the materialized benchmark workspace:

- `tmp/drizzle-benchmarks-rawsql/results/*-summary.json`
- `tmp/drizzle-benchmarks-rawsql/results/*.log`
- `tmp/drizzle-benchmarks-rawsql/results/aggregate-summary.json`
- `tmp/drizzle-benchmarks-rawsql/results/aggregate-main-with-rfba-summary.json`
- `tmp/drizzle-benchmarks-rawsql/results/aggregate-rfba-generated-summary.json`
- `tmp/drizzle-benchmarks-rawsql/results/aggregate-rfba-optimized-summary.json`
- `tmp/drizzle-benchmarks-rawsql/results/mapper-profile-summary.json`
- `tmp/drizzle-benchmarks-rawsql/seed.log`

## Analysis

`rawsql-ts minimal` was comparable to Drizzle in throughput. Average throughput was about 1.5% higher than Drizzle in this local run set, and the median run was about 9.5% higher. Tail latency told a more mixed story: rawsql-ts minimal had higher average p95/p99 than Drizzle, while its median p99 was slightly lower than Drizzle's median p99 because Drizzle's run-to-run spread was also large.

The difference between Drizzle and rawsql-ts minimal is unlikely to be explained only by ORM or mapper overhead. This benchmark runs through HTTP routing, JSON serialization, PostgreSQL, node-postgres pooling, and a very high k6 VU schedule. Those costs can easily dominate the query abstraction layer. The run-to-run variance in Drizzle also suggests local machine scheduling and Docker/Windows host effects are material.

The rawsql-ts implementation does server-side mapping for nested endpoints. That mapping did not prevent the minimal target from staying in the same throughput range as Drizzle.

The initial RFBA + sql-contract target gave a different signal. It improved maintainability by separating runtime catalog loading, prepared DB execution, endpoint boundaries, and feature-local mapping definitions, but its generic sql-contract runtime mapping path was slower. The likely sources were mapper abstraction overhead, repeated generic key/object construction, and manual one-to-many aggregation for order detail responses after row mapping.

The generated-mapper RFBA target keeps the same RFBA structure but moves hot DTO mapping into query-local generated mapper files. This removes the hot-path generic `Object.entries`/`Map`/case-insensitive lookup/relation traversal work from the measured nested endpoints while keeping the boundary code thin. Average throughput improved from 4,001.54 req/sec in the initial RFBA target to 5,121.76 req/sec, a 28.0% lift. Compared with Drizzle average throughput, the RFBA target moved from 17.6% behind to 5.5% ahead in this local run set. The median comparison is also positive: generated RFBA was 13.2% ahead of Drizzle by median run throughput, versus 15.5% behind before optimization.

The generated-mapper HTTP result is only a small average throughput improvement over the previous compiled-projector-optimized run: 5,121.76 req/sec versus 5,078.65 req/sec, about 0.8%. The median run improved more clearly, from 4,441.86 to 5,206.57 req/sec. This matches the profiler direction, but it also shows that once mapping overhead is reduced, full HTTP throughput is dominated by DB execution, response serialization, Docker networking, and local scheduler variance. The mapper profile proves the generated mapper is much faster in isolation; the HTTP benchmark shows the end-to-end gain is real but not proportional to the microbenchmark speedup.

This is a useful result: it separates the performance story into two layers. The SQL-first execution path itself appears competitive in the minimal target. The maintainable RFBA + sql-contract shape can preserve that performance range when mapper automation is compiled or specialized instead of interpreted on every row.

### Runtime Cost vs Development-Time Guarantees

The generated-mapper path intentionally keeps runtime lean: execute prepared SQL, perform minimal DTO mapping, and return JSON. Correctness is not removed from the system; it is shifted to development time. SQL behavior is covered by real database ZTD tests, DTO shape is checked against actual query results, and generated mappers are protected by drift detection between the query boundary contract and `generated/row-mapper.ts`.

This makes generated mappers the standard RFBA execution path rather than an opt-in performance mode. The architectural rule is: pay for correctness once during development, not on every request. That rule depends on CI/test enforcing both ZTD tests and generated mapper drift checks. Without those checks, the runtime path remains fast but the correctness guarantee is weaker.

The one failed request in `rawsql-minimal-run-1` is small relative to 1.7M requests, but it should not be hidden. The two subsequent minimal runs had zero failed requests. The initial, compiled-projector-optimized, and generated RFBA sql-contract targets all completed three full runs with zero failed requests.

### Variance Notes

The rawsql-ts minimal p50 varied significantly across runs:

| run | req/sec | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|---:|
| rawsql-minimal-run-1 | 5,411.48 | 3.59 | 593.51 | 611.20 |
| rawsql-minimal-run-2 | 4,345.24 | 176.33 | 655.37 | 691.10 |
| rawsql-minimal-run-3 | 5,036.05 | 8.46 | 617.70 | 645.82 |

The generated RFBA target showed the same kind of variance:

| run | req/sec | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|---:|
| rawsql-rfba-generated-run-1 | 6,200.15 | 3.09 | 428.97 | 443.75 |
| rawsql-rfba-generated-run-2 | 5,206.57 | 3.87 | 509.10 | 526.32 |
| rawsql-rfba-generated-run-3 | 3,958.55 | 237.44 | 581.01 | 609.57 |

This looks like a workload and local-environment effect rather than a deterministic mapper difference. The official request list is heavily skewed toward a few endpoints: `/order-with-details-and-products`, `/product-with-supplier`, and `/order-with-details` are each 26.88% of the measured request list. The k6 scenario cycles through a shuffled request list while throughput differs by run, so each run may spend a different amount of time in different parts of the request cycle. At the same time, the benchmark runs at up to 3000 VUs on a Windows + Docker host, where scheduler and container networking effects can move the median sharply.

The k6 summary has only aggregate latency for this run. A follow-up benchmark should tag requests by endpoint so p50/p95/p99 can be split by endpoint. That would show whether the low p50 runs are dominated by very fast single-row endpoints or whether a server/runtime scheduling effect is present.

### Single Failed Request

The one failed rawsql-ts minimal request was:

```text
GET /employee-with-recipient?id=108
error="dial tcp 192.168.65.254:3000: connect: connection refused"
```

That error is not endpoint-specific application behavior. It is a connection-level refusal, not a SQL error, mapping error, timeout, or non-2xx response. The same target completed the next two full runs with zero failed requests, and the RFBA sql-contract targets completed nine full runs with zero failed requests across initial, compiled-projector-optimized, and generated variants. The most likely classification is transient local server/container networking or worker availability during the run. For stronger evidence, future runs should add worker-exit timestamps and k6 endpoint tags.

### Why rawsql-ts Was Comparable, Not Clearly Faster

The expectation that rawsql-ts can be faster is reasonable: rawsql-ts minimal does not build SQL per request, and it does not parse SQL per request. In this benchmark, SQL files are read and parsed at startup only. Request-time work is parameter coercion, node-postgres prepared query execution, server-side mapping, and JSON response serialization.

The reason this did not translate into a clear overall win is likely that SQL construction is not the dominant cost in this HTTP benchmark. The measured path includes:

- k6 client load and Docker networking
- Hono routing
- node-postgres pool scheduling
- PostgreSQL query execution and result transfer
- server-side nested mapping for rawsql-ts
- JSON serialization of often-large response bodies
- Windows host scheduling under a 3000 VU profile

Drizzle also prepares query objects at startup in the inspected target. That means the comparison is mostly steady-state prepared execution plus result mapping, not repeated Drizzle SQL construction versus repeated rawsql-ts raw execution on every request.

The current rawsql-ts benchmark still parses SQL at startup to prove the SQL files are understood by rawsql-ts. Because this happens before serving traffic, it should not materially affect req/sec or latency. A `raw` / `unparsed` / `parse: false` option for static SQL is still worth considering for cold start, very large query catalogs, and a purer SQL passthrough baseline mode. It would not be expected to change steady-state HTTP latency much unless startup work is included in the benchmark.

### RFBA and sql-contract Mapper Maintainability

The RFBA target is operationally plausible. It is not a benchmark-only shortcut: startup catalog preparation, a shared DB executor, endpoint-owned feature boundaries, and feature-local mapper definitions are all patterns that can be maintained in an application codebase.

The trade-off was visible in the initial measurements. The initial RFBA target averaged 4,001.54 req/sec versus Drizzle's 4,856.55 req/sec and rawsql-ts minimal's 4,930.92 req/sec. This did not mean SQL-first was inherently slower; the minimal target argued against that. It meant the generic mapper path was the next performance bottleneck once SQL execution overhead was removed from the hot path.

The mapper profile confirmed that diagnosis. For the hottest nested DTO shapes, compiled projectors were 9.60x faster for `/product-with-supplier` mapping and 13.31x faster for `/order-with-details-and-products` mapping in the original profile. The generated mapper profile is faster still, at 54.0M ops/sec for product-with-supplier and 8.9M ops/sec for order-with-details-and-products in the latest local profile run. The generated RFBA benchmark result then showed the same direction at the HTTP level: average throughput improved from 4,001.54 to 5,121.76 req/sec, p95 improved from 714.55ms to 506.36ms, and p99 improved from 758.51ms to 526.55ms.

sql-contract mapper automation should still be kept. It provides the maintainability benefit that the minimal target lacks. The next improvement should be to make the automated mapper faster, not to remove mapper automation. The most promising options are:

- Keep specialized row mapper functions generated from sql-contract/queryspec metadata as the RFBA scaffold standard path.
- Add first-class `hasMany`/one-to-many mapping support for flat joined rows, reducing manual aggregation code in features such as orders.
- Keep a benchmark mode that compares interpreted sql-contract mapping versus generated/compiled sql-contract mapping under the same RFBA structure.
- Keep validation separate from mapping unless Drizzle receives equivalent validation in the same benchmark.

## Conclusion

Under this local benchmark, rawsql-ts minimal can reasonably be described as comparable to Drizzle and "not meaningfully slower" for the measured HTTP API workload. It is not a clean win across all latency percentiles, but it supports the intended claim: rawsql-ts is a SQL-first baseline implementation for comparison, and keeping SQL as SQL does not necessarily impose meaningful runtime overhead.

The generated RFBA + sql-contract target is maintainable and realistic, and it reached the same practical performance range as Drizzle in this local benchmark. The earlier 17.6% average throughput gap was more than halved; on average it disappeared in this run set, and the median comparison also put generated RFBA ahead of Drizzle under these local conditions.

The remaining conclusion is conditional but positive: RFBA/sql-contract is a good application structure, and preserving minimal-target performance is practical when hot DTO mapping uses generated sql-contract mappers as the scaffold-standard internal path.

There is value in preparing an upstream benchmark PR after tightening the benchmark harness and documenting the migration compatibility patch. The PR should be framed neutrally: rawsql-ts demonstrates a SQL-first baseline alongside Drizzle, not an attack on Drizzle.

## Optional Validation Overhead

The validation target was run, but it is excluded from the main comparison because the Drizzle target does not add equivalent response validation.

Average across three validation runs:

| target | req/sec | p50 ms | p90 ms | p95 ms | p99 ms | error rate |
|---|---:|---:|---:|---:|---:|---:|
| rawsql-ts with validation | 4,003.23 | 253.07 | 628.79 | 666.43 | 708.09 | 0.000000% |

Individual validation runs:

| run | req/sec | p50 ms | p95 ms | p99 ms | failed requests |
|---|---:|---:|---:|---:|---:|
| rawsql-validation-run-1 | 4,157.22 | 216.28 | 654.30 | 697.81 | 0 |
| rawsql-validation-run-2 | 3,915.22 | 273.65 | 672.28 | 712.60 | 0 |
| rawsql-validation-run-3 | 3,937.26 | 269.26 | 672.72 | 713.86 | 0 |
