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

## Comparison Model

The primary purpose of this benchmark is to estimate the best observed direct SQL range, then compare `rawsql-ts` against that range to judge remaining optimization headroom. The handwritten target is expected to be the closest target to zero framework overhead: SQL is already written, parameters are passed directly to `node-postgres`, and DTO mapping is hand-written.

`rawsql-ts RFBA + AOT generated mapper` should be close to the handwritten target. If it is slower than Drizzle, that is a diagnostic signal rather than an expected outcome. The likely investigation areas are query-local indirection, per-request value allocation, query execution wrapper cost, pool/process state, endpoint shape differences, and whether startup SQL parsing is accidentally leaking into the hot path. Startup parsing itself should not affect steady-state request latency.

| target | SQL strategy | mapper strategy | startup work | request-time hot path | expected overhead profile |
|---|---|---|---|---|---|
| handwritten direct SQL reference | SQL files are written ahead of time and loaded as text | hand-written DTO mapping | SQL file read, pool creation | parameter coercion, prepared SQL execution, direct DTO mapping | ceiling candidate; lowest intended app-layer overhead |
| Drizzle | query objects are built and prepared at startup | Drizzle JIT row mapper (`useJitMappers:true`) | query builder construction, prepare, pool creation | parameter coercion, prepared query execution, JIT mapper | ORM overhead should be near raw driver according to Drizzle's benchmark goal |
| rawsql-ts RFBA + AOT generated mapper | SQL files are written ahead of time; current benchmark parses SQL at startup for rawsql-ts compatibility and dynamic-condition support | AOT generated row mapper under `features/<feature>/generated/` | SQL file read, SQL parse, query catalog creation, pool creation | parameter coercion, rows-only prepared SQL execution through RFBA executor, AOT mapper | should be close to handwritten; any steady-state gap is actionable |

This framing makes the handwritten target useful even before it is a validated stable ceiling. If handwritten is not the fastest in a controlled run, the benchmark should first inspect implementation parity and runtime state before treating the result as a rawsql-ts or Drizzle finding.

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

Use the Pure ORM runner for rawsql-ts performance work. HTTP benchmark tooling remains in the overlay for future app-level regression checks, but it is intentionally out of the current optimization loop.

Pure ORM benchmark:

```sh
pnpm bench:pure-orm -- --targets=handwritten,drizzle,rfba --runs=3 --iterations=2000 --warmup=100 --folder=results-pure-orm
```

Startup cost benchmark:

```sh
pnpm bench:startup-cost -- --runs=20 --folder=results-startup-cost
```

The pure ORM runner does not start Hono, does not use k6, and does not cross Docker networking for HTTP traffic. It measures:

- `db-query-only`: direct `pg` execution for handwritten/rawsql SQL and captured Drizzle-generated SQL for Drizzle.
- `db-query-mapper`: each target's natural query path, including Drizzle JIT mapper, RFBA AOT mapper, and handwritten mapper.
- `mapper-only`: fixture rows with no DB round trip.
- `mapper-json`: fixture rows plus `JSON.stringify`.
- `executor-only-*`, `params-*`, `call-chain-*`, and `aggregation-*`: breakdown phases for rawsql-ts overhead investigation.

The primary outward-facing comparison should use:

- Drizzle
- rawsql-ts RFBA + AOT generated mapper
- handwritten direct SQL reference

The ongoing benchmark intentionally excludes `rawsql-ts minimal` and validation targets. The recommended rawsql-ts representative is the scaffolded RFBA + AOT path; validation should only be compared in a separate run where Drizzle performs equivalent validation.

Profile hot mapper paths:

```sh
pnpm exec tsx profiles/mapper-profile.ts
```

The HTTP/k6 helpers are still materialized for compatibility with the official benchmark, but do not run them before Pure ORM has identified a rawsql-ts optimization target.

## Latest report: 2026-05-03

### Summary

The primary comparison is now the Pure ORM benchmark. HTTP results are intentionally out of scope for this report because they mix Hono routing, JSON serialization, k6, Docker networking, Windows scheduling, PostgreSQL state, and process scheduling. They should not delay rawsql-ts improvement planning.

In the pure ORM benchmark after the breakdown and AOT inline mapper pass, `rawsql-ts RFBA + AOT generated mapper` is in the same DB execution range as Drizzle and handwritten direct SQL. Its `db-query-mapper` average is in the same range as both targets for the measured cases.

The mapper-only result does not show RFBA AOT mapper as the bottleneck. RFBA AOT mapper is in the same top mapper range as handwritten and far above the DB query rate. JSON serialization is larger than the mapper itself for these response shapes.

The handwritten target should still be treated as a direct SQL reference / ceiling candidate, not a validated ceiling. In pure mapper-only it is fastest, but in DB query-only the winner varies by SQL text and case, so the ceiling claim needs endpoint-level SQL parity and stable repeated evidence.

### Method

- Benchmark source: official Drizzle benchmark at `2ae27415a69f00b4f0f734ebb0a98e7799008819`, materialized through `scripts/materialize.mjs`.
- Runtime: Node `v22.14.0`, pnpm `10.17.0`.
- OS: Microsoft Windows 11 Home, OS version `10.0.26200`, build `26200`, WindowsVersion `2009`, x64-based PC.
- Hardware: AMD Ryzen 7 7800X3D 8-Core Processor, 8 cores / 16 logical processors, max clock `4201 MHz`, L2 cache `8192 KB`, L3 cache `98304 KB`.
- Memory: 32 GiB installed class. `Get-ComputerInfo` reported `33,378,181,120` bytes total physical memory; system memory observation reported `34,359,738,368` bytes.
- Docker: Docker `27.3.1`, build `ce12230`.
- PostgreSQL: `PostgreSQL 18.3 (Debian 18.3-1.pgdg13+1) on x86_64-pc-linux-gnu, gcc 14.2.0-19, 64-bit`.
- PostgreSQL settings observed for benchmark: `max_connections=300`, `shared_buffers=128MB`, `work_mem=4MB`.
- Seed size: `customers=10000`, `products=5000`, `orders=50000`, `order_details=307308`.

### 1. Pure ORM Benchmark

Command:

```sh
pnpm bench:pure-orm -- --runs=3 --iterations=2000 --warmup=100 --folder=results-pure-orm-20260503-breakdown-baseline
```

Measurement log:

- `benchmarks/drizzle-official-comparison/results-pure-orm-20260503-accepted-aot-direct-assignment/pure-orm-summary.json`

The accepted folder is a clarity alias for the measured direct-assignment run. The original measured folder was named `results-pure-orm-20260503-breakdown-baseline`, but that run already included generated direct-assignment aggregation in the RFBA AOT mapper path.

Each target uses `pg.Pool({ min: 10, max: 10 })`. Target order is rotated:

| run | target order |
|---:|---|
| 1 | handwritten, drizzle, rfba |
| 2 | drizzle, rfba, handwritten |
| 3 | rfba, handwritten, drizzle |

The table below averages the three measured query cases: `products`, `productWithSupplier`, and `orderWithDetailsAndProducts`.

| phase | target | ops/sec avg | p50 avg | p95 avg | p99 avg |
|---|---|---:|---:|---:|---:|
| DB query only | handwritten direct SQL | 1,534.29 | 0.6395ms | 0.7548ms | 0.9477ms |
| DB query only | Drizzle generated SQL reference | 1,582.39 | 0.6130ms | 0.7452ms | 0.9461ms |
| DB query only | rawsql-ts RFBA SQL | 1,565.46 | 0.6212ms | 0.7612ms | 0.9544ms |
| DB query + mapper | handwritten direct SQL | 1,570.23 | 0.6084ms | 0.7663ms | 0.9759ms |
| DB query + mapper | Drizzle JIT mapper | 1,547.65 | 0.6270ms | 0.7655ms | 0.9514ms |
| DB query + mapper | rawsql-ts RFBA + AOT mapper | 1,572.09 | 0.6085ms | 0.7282ms | 0.8971ms |

Interpretation:

- DB execution dominates these measurements. All three targets are in the same narrow range.
- RFBA + AOT is in the same `db-query-mapper` range as handwritten and Drizzle in this run.
- Drizzle's `db-query-only` row uses captured Drizzle-generated SQL executed through `pg`, so it isolates DB execution from Drizzle's mapper as much as this benchmark can without changing Drizzle internals.

### 2. Mapper Microbenchmark

The mapper microbenchmark uses fixture rows and does not touch the DB. `mapper-json` adds `JSON.stringify` to estimate response serialization cost before HTTP.

| phase | target | ops/sec avg | p50 avg | p95 avg | p99 avg |
|---|---|---:|---:|---:|---:|
| mapper only | handwritten mapper | 3,559,499.49 | 0.0002ms | 0.0003ms | 0.0005ms |
| mapper only | Drizzle JIT mapper path | 652,281.30 | 0.0014ms | 0.0022ms | 0.0033ms |
| mapper only | rawsql-ts RFBA AOT mapper | 4,054,218.57 | 0.0002ms | 0.0003ms | 0.0006ms |
| mapper + JSON stringify | handwritten mapper | 332,655.02 | 0.0036ms | 0.0051ms | 0.0057ms |
| mapper + JSON stringify | Drizzle JIT mapper path | 193,977.88 | 0.0049ms | 0.0082ms | 0.0132ms |
| mapper + JSON stringify | rawsql-ts RFBA AOT mapper | 331,674.32 | 0.0039ms | 0.0057ms | 0.0075ms |

Interpretation:

- RFBA AOT mapper is in the same top mapper range as handwritten and much faster than the DB query rate. It is not the current bottleneck.
- JSON serialization costs more than the RFBA AOT mapper for these cases, so application-level response cost can hide mapper differences quickly.
- Drizzle's mapper-only path is measured through a fake `pg` client that returns captured Drizzle raw rows. This keeps Drizzle's normal prepared-query mapper path, but it also includes Drizzle execute-path machinery around the mapper.

### 3. rawsql-ts Performance Interpretation

`rawsql-ts RFBA + AOT generated mapper` is the recommended rawsql-ts benchmark representative. The pure ORM `db-query-mapper` result is the primary optimization signal, and `mapper-only` is the primary signal for generated mapper work.

The current result suggests the generated mapper itself is not the main bottleneck: RFBA AOT mapper is close to handwritten and much faster than the DB query rate. The remaining RFBA gap should be investigated in the query path before changing public usage.

Implemented / measured in this pass:

- The Pure ORM RFBA runner no longer clones parameter arrays before `pg.Pool.query`, matching the benchmark executor more closely to the RFBA server executor.
- Generated mappers for the hot nested DTOs now use direct assignment instead of helper calls plus object spread. This preserves the RFBA scaffold usage model while reducing mapper-only allocation/function-call overhead.
- Breakdown phases show parameter construction is not a useful next target, minimized executor invocation is noisy, and generated aggregation shape is the meaningful accepted improvement.
- Ashiba generated mappers now emit preallocated-loop direct assignment, so ordinary RFBA scaffold output follows the same direction without asking users to choose a special performance mode.

Next rawsql-ts optimization candidates:

- executor indirection
- query-local call structure
- parameter coercion
- object allocation
- generated mapper output shape
- one-to-many aggregation
- SQL parsing and catalog loading startup cost

Do not choose optimizations from HTTP-only rankings. HTTP can confirm that the application stack has no large regression, but Pure ORM and mapper microbenchmarks should drive rawsql-ts performance work.

### 4. Follow-up Optimization Targets

- **DB execution cost:** Pure DB query throughput is close across handwritten, Drizzle-generated SQL, and RFBA SQL. There is no evidence here that rawsql-ts has a meaningful DB execution disadvantage.
- **Mapper cost:** RFBA AOT mapper is much closer to handwritten than to a slow dynamic mapper. The remaining RFBA `db-query-mapper` gap is more likely query-local call structure, value allocation, or executor indirection than raw mapper construction.
- **JSON serialization cost:** JSON stringify is larger than mapper-only for these fixture shapes. In HTTP results, JSON and routing can easily dominate sub-millisecond mapper differences.
- **HTTP routing / k6 / Docker networking cost:** out of scope for the current performance-improvement loop. These costs are useful for app-level regression checks, but not for identifying rawsql-ts ORM or mapper overhead.
- **Handwritten target:** Pure mapper-only validates handwritten as the fastest mapper in this local run. Pure DB query-only does not validate handwritten as a universal ceiling because SQL text and planner behavior still vary. It should remain a direct SQL reference / ceiling candidate until endpoint-level SQL parity proves a stable ceiling.

### Conclusion

`rawsql-ts RFBA + AOT generated mapper` is in the same pure ORM performance range as Drizzle and handwritten direct SQL under this measurement. The recommended RFBA scaffold shape does not appear to impose a meaningful steady-state mapper penalty.

The next optimization work should focus on the small remaining RFBA `db-query-mapper` gap while preserving the standard RFBA user experience: keep generated mappers as the natural scaffolded internal path, avoid making users choose a special fast mode, and investigate query-local executor indirection and value allocation before changing public APIs.

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
- Validation is out of scope for the ongoing main comparison unless Drizzle also adds equivalent validation in the same benchmark layer.
