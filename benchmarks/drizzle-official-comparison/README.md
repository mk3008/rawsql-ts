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
DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres"
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
| run-1 | yes | drizzle, rfba, handwritten |
| run-2 | yes | rfba, handwritten, drizzle |
| run-3 | yes | handwritten, drizzle, rfba |

Each run uses `grafana/k6:0.54.0` unless `K6_IMAGE` is explicitly set. The overlay k6 script emits endpoint tags and endpoint-specific duration trends such as `endpoint_product_with_supplier_duration`, so the summary JSON includes per-endpoint `med`, `p(95)`, and `p(99)` values.

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

## Notes

- The official `bench/bench.js` filters out `/search-*` requests before execution. This overlay keeps that behavior unchanged.
- The inspected upstream commit has a migration/schema mismatch for `products.quantity_per_unit`; `materialize.mjs` updates the migration from the older `qt_per_unit` column name so the official seed can run against the official current schema. This applies to both Drizzle and rawsql-ts targets.
- The inspected upstream commit also has one stale Drizzle connection call in `src/generate.ts`; `materialize.mjs` rewrites it to `drizzle({ client, logger: false })` so `pnpm start:generate` uses the configured `DATABASE_URL`.
- The rawsql-ts server parses every SQL file at startup through `SelectQueryParser.parse`.
- The rawsql-ts server uses node-postgres prepared query names matching each endpoint.
- The rawsql-ts nested endpoints return flat SQL rows and build nested response objects in the server runtime. They do not use PostgreSQL `jsonb_build_object` or `jsonb_agg`.
- The RFBA target follows the scaffolded feature-first shape used by `packages/transfer`: `adapters/pg`, `features/_shared`, and endpoint-owned `features/<feature>/boundary.ts` entrypoints. It keeps validation out of the hot path and moves hot nested DTO construction into machine-owned `features/<feature>/generated/row-mapper.ts` files.
- Treat the handwritten target as a direct SQL reference and theoretical ceiling candidate, not as a validated ceiling. Before using it as a ceiling, confirm SQL text, prepared query names, parameter binding, `pg.Pool` settings, Hono route shape, response shape, DTO mapping allocation, and endpoint-level latency parity against RFBA + AOT.
- `profiles/mapper-profile.ts` compares the generic `mapRows` path, compiled projector path, and generated mapper path for the hottest nested DTO shapes.
- The validation target intentionally measures response validation separately from the minimal SQL-first path. Do not include it in the main Drizzle comparison unless the Drizzle target also adds equivalent validation.
