# rawsql-ts vs Drizzle Official Benchmark

This benchmark extension adds `rawsql-ts` targets to the official Drizzle benchmark without changing the Drizzle implementation, seed, HTTP endpoints, DB driver, or Hono HTTP server shape.

Official upstream benchmark:

- Repository: <https://github.com/drizzle-team/drizzle-benchmarks>
- Baseline inspected commit: `2ae27415a69f00b4f0f734ebb0a98e7799008819`
- Drizzle docs page: <https://orm.drizzle.team/benchmarks>

## Targets

| target | server script | port | validation |
|---|---|---:|---|
| Drizzle | `src/drizzle-server-node.ts` | 3000 | Drizzle mapping only |
| rawsql-ts RFBA + AOT generated mapper | `src/rawsql-rfba-server-node.ts` | 3000 | RFBA generated row mappers for hot nested DTOs, no validation |
| handwritten direct SQL reference | `src/handwritten-server-node.ts` | 3000 | none; direct SQL execution and hand-written DTO mapping |
| rawsql-ts minimal reference | `src/rawsql-server-node.ts` | 3000 | internal/debug reference, none beyond parameter coercion |
| rawsql-ts with validation | `src/rawsql-server-node-validation.ts` | 3000 | optional diagnostic only |

## Prepare

From the rawsql-ts repository root:

```sh
node benchmarks/drizzle-official-comparison/scripts/materialize.mjs
cd tmp/drizzle-benchmarks-rawsql
pnpm install --ignore-workspace
```

Create or update `.env` in the materialized benchmark directory:

```env
DATABASE_URL="postgres://postgres:postgres@localhost:5435/postgres"
```

Seed and generate the official request list:

```sh
pnpm start:docker
pnpm start:seed
pnpm start:generate
```

## Run

Use the same benchmark runner for each main target. Run at least three passes per target for a report-quality comparison.
Run one warmup pass first and exclude it from aggregate results. For the main comparison, use the pinned Docker k6 image and rotate target order so no target always benefits from the same cache/scheduler position.

The primary outward-facing comparison should use:

- Drizzle
- rawsql-ts RFBA + AOT generated mapper
- handwritten direct SQL reference

`rawsql-ts minimal` remains available as an internal/debug reference target, but it is not the recommended rawsql-ts representative because the scaffolded RFBA + AOT path is the design shape rawsql-ts wants users to adopt.

```sh
pnpm bench:k6:docker:rotated -- --targets handwritten,drizzle,rfba --runs 3 --folder results-rotated
```

With those targets, the rotated helper runs targets in this order:

| pass | measured | target order |
|---|---|---|
| warmup | no | handwritten, drizzle, rfba |
| run-1 | yes | handwritten, drizzle, rfba |
| run-2 | yes | drizzle, rfba, handwritten |
| run-3 | yes | rfba, handwritten, drizzle |

Each target process starts with `RAWSQL_PG_POOL_MIN=10` and `RAWSQL_PG_POOL_MAX=10`; the materialized Docker PostgreSQL helper starts PostgreSQL with `max_connections=300` so 16 Node workers can each use a 10-connection pool without hitting the default 100 connection limit. Each run uses `grafana/k6:0.54.0` unless `K6_IMAGE` is explicitly set. Before each k6 run, the helper warms the measured endpoint set multiple times to exercise routes, pools, prepared statements, and hot mappers consistently. The overlay k6 script emits endpoint tags and endpoint-specific duration trends such as `endpoint_product_with_supplier_duration`, so the summary JSON includes per-endpoint `med`, `p(95)`, and `p(99)` values.

Include `rawsql` in `--targets` only when you want the minimal SQL-first reference alongside the main comparison:

```sh
pnpm bench:k6:docker:rotated -- --targets handwritten,drizzle,rawsql,rfba --runs 3 --folder results-rotated-with-minimal
```

```sh
# terminal 1
pnpm start:drizzle

# terminal 2
pnpm exec tsx bench/index.ts --host http://localhost:3000 --name drizzle-run-1 --folder results
```

```sh
# terminal 1
pnpm start:handwritten

# terminal 2
pnpm exec tsx bench/index.ts --host http://localhost:3000 --name handwritten-run-1 --folder results
```

```sh
# terminal 1
pnpm start:rawsql

# terminal 2
pnpm exec tsx bench/index.ts --host http://localhost:3000 --name rawsql-minimal-run-1 --folder results
```

```sh
# terminal 1
pnpm start:rawsql:rfba

# terminal 2
pnpm exec tsx bench/index.ts --host http://localhost:3000 --name rawsql-rfba-run-1 --folder results
```

Merge final outputs:

```sh
pnpm exec tsx bench/prepare.ts --folder results
```

Profile hot mapper paths:

```sh
pnpm exec tsx profiles/mapper-profile.ts
```

If local `k6` is not installed, run the k6 phase with Docker from `tmp/drizzle-benchmarks-rawsql` while the target server is listening on port 3000:

```sh
pnpm bench:k6:docker -- --host http://host.docker.internal:3000 --name rawsql-minimal-run-1 --folder results
```

The Docker helper defaults to the pinned image `grafana/k6:0.54.0`. Set `K6_IMAGE` if you need to reproduce an earlier run with another image.

For a quick wiring smoke test:

```sh
pnpm bench:k6:docker:smoke
```

The official `bench/index.ts` also records CPU usage and converts CSV to parquet, so prefer it when local k6 and DuckDB are available.

## Latest report: 2026-05-03

### Summary

Under the 2026-05-03 local benchmark run, `rawsql-ts RFBA + AOT generated mapper` remained in the same broad HTTP/DB benchmark range as Drizzle, but it was slower than Drizzle in the aggregate result. The direct SQL handwritten reference was fastest in this run and is useful as a ceiling candidate, but it is still reported as a direct SQL reference rather than a validated stable ceiling.

The result does not show mapper-only overhead as the main explanation. Slow runs had nearly uniform endpoint p50 shifts across simple endpoints and nested mapper endpoints, which points to run-level scheduling, connection, or shared resource state being a large part of the observed variance.

### Method

- Benchmark source: official Drizzle benchmark at `2ae27415a69f00b4f0f734ebb0a98e7799008819`, materialized through `scripts/materialize.mjs`.
- Runtime: Node server targets with Hono and node-postgres.
- Database: PostgreSQL Docker container on port 5435, configured with `max_connections=300`.
- k6 image: `grafana/k6:0.54.0`.
- Command: `pnpm bench:k6:docker:rotated -- '--targets=handwritten,drizzle,rfba' '--runs=3' '--folder=results-rotated-20260503-official'`.
- Warmup: one full warmup pass excluded from results, plus per-target endpoint warmup before each k6 run.
- Target order: warmup and run-1 use `handwritten, drizzle, rfba`; run-2 uses `drizzle, rfba, handwritten`; run-3 uses `rfba, handwritten, drizzle`.
- Measurement logs: `benchmarks/drizzle-official-comparison/results-rotated-20260503-official/*.json`.

### Results

`req/sec` is the average across the three measured runs. Latency columns are the median of each run's k6 percentile for `http_req_duration{expected_response:true}`. Error rate is total failed requests across the three measured runs.

| target | req/sec avg | req/sec median | p50 | p90 | p95 | p99 | error rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| handwritten direct SQL reference | 6,561.89 | 6,509.92 | 16.27ms | 366.04ms | 376.27ms | 390.04ms | 0.000000% |
| Drizzle | 5,267.19 | 5,622.77 | 66.48ms | 543.23ms | 564.15ms | 580.01ms | 0.000000% |
| rawsql-ts RFBA + AOT generated mapper | 4,641.21 | 4,209.58 | 213.31ms | 589.61ms | 628.11ms | 657.61ms | 0.000000% |

Per-run summary:

| target | run | req/sec | p50 | p95 | p99 |
|---|---:|---:|---:|---:|---:|
| handwritten direct SQL reference | 1 | 6,488.82 | 3.24ms | 446.39ms | 461.70ms |
| handwritten direct SQL reference | 2 | 6,509.92 | 16.27ms | 376.27ms | 390.04ms |
| handwritten direct SQL reference | 3 | 6,686.94 | 51.58ms | 343.95ms | 362.25ms |
| Drizzle | 1 | 5,723.70 | 66.48ms | 447.44ms | 463.75ms |
| Drizzle | 2 | 5,622.77 | 3.51ms | 564.15ms | 580.01ms |
| Drizzle | 3 | 4,455.09 | 165.51ms | 621.03ms | 654.41ms |
| rawsql-ts RFBA + AOT generated mapper | 1 | 4,209.58 | 213.31ms | 632.87ms | 657.61ms |
| rawsql-ts RFBA + AOT generated mapper | 2 | 4,014.61 | 260.83ms | 628.11ms | 658.56ms |
| rawsql-ts RFBA + AOT generated mapper | 3 | 5,699.45 | 3.46ms | 541.19ms | 556.45ms |

### Analysis

- The handwritten target is not intrinsically slow. A stopped earlier run had handwritten last and slow, but a handwritten-only diagnostic run reached `5,992.55 req/sec` with `p50 3.72ms`, and the official rerun with handwritten first reached `6,488.82 req/sec` in run-1.
- RFBA was slower than Drizzle in this official run, but its run-3 result was close to Drizzle's best range. RFBA run-1/run-2 had uniformly high p50 across both simple endpoints and nested mapper endpoints, so the gap cannot be explained by generated mapper cost alone.
- The direct SQL reference and rawsql-ts response sizes are effectively identical (`~1,347 bytes/request`), while Drizzle responses are slightly larger (`~1,357 bytes/request`). Response size does not explain RFBA's slower runs.
- The current benchmark is highly sensitive to target order and local scheduling state. The report should avoid claiming a stable ceiling until the direct SQL reference is repeatedly fastest across target orders and endpoint latency remains stable.
- The next useful diagnostic is to capture per-worker connection counts, event-loop delay, and process CPU/memory during each run, especially when a target's p50 shifts uniformly across all endpoints.

### Conclusion

For this run, `rawsql-ts RFBA + AOT generated mapper` is not as fast as Drizzle in aggregate, but the difference appears dominated by run-level/server-state variance rather than mapper-only overhead. The recommended RFBA + AOT shape is still a viable comparison target, but more diagnostics are needed before making a strong public performance claim.

The handwritten target should remain a direct SQL reference / ceiling candidate. It is valuable for showing the best observed local range, but it is not yet a validated stable ceiling.

## Notes

- The official `bench/bench.js` filters out `/search-*` requests before execution. This overlay keeps that behavior unchanged.
- The inspected upstream commit has a migration/schema mismatch for `products.quantity_per_unit`; `materialize.mjs` updates the migration from the older `qt_per_unit` column name so the official seed can run against the official current schema. This applies to both Drizzle and rawsql-ts targets.
- The inspected upstream commit also has one stale Drizzle connection call in `src/generate.ts`; `materialize.mjs` rewrites it to `drizzle({ client, logger: false })` so `pnpm start:generate` uses the configured `DATABASE_URL`.
- The materialized Docker PostgreSQL helper sets `max_connections=300` for the benchmark because 16 Node workers with `pg.Pool({ min: 10, max: 10 })` can otherwise exceed PostgreSQL's default 100 connection limit.
- The rawsql-ts server parses every SQL file at startup through `SelectQueryParser.parse`.
- The rawsql-ts server uses node-postgres prepared query names matching each endpoint.
- The rawsql-ts nested endpoints return flat SQL rows and build nested response objects in the server runtime. They do not use PostgreSQL `jsonb_build_object` or `jsonb_agg`.
- The RFBA target follows the scaffolded feature-first shape used by `packages/transfer`: `adapters/pg`, `features/_shared`, and endpoint-owned `features/<feature>/boundary.ts` entrypoints. It keeps validation out of the hot path and moves hot nested DTO construction into machine-owned `features/<feature>/generated/row-mapper.ts` files.
- Treat the handwritten target as a direct SQL reference and theoretical ceiling candidate, not as a validated ceiling. Before using it as a ceiling, confirm SQL text, prepared query names, parameter binding, `pg.Pool` settings, Hono route shape, response shape, DTO mapping allocation, and endpoint-level latency parity against RFBA + AOT.
- `profiles/mapper-profile.ts` compares the generic `mapRows` path, compiled projector path, and generated mapper path for the hottest nested DTO shapes.
- The validation target intentionally measures response validation separately from the minimal SQL-first path. Do not include it in the main Drizzle comparison unless the Drizzle target also adds equivalent validation.
