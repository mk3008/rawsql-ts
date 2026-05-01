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
| rawsql-ts minimal | `src/rawsql-server-node.ts` | 3000 | none beyond parameter coercion |
| rawsql-ts RFBA sql-contract | `src/rawsql-rfba-server-node.ts` | 3000 | RFBA generated row mappers for hot nested DTOs, no validation |
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

```sh
# terminal 1
pnpm start:drizzle

# terminal 2
pnpm exec tsx bench/index.ts --host http://localhost:3000 --name drizzle-run-1 --folder results
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
- `profiles/mapper-profile.ts` compares the generic `mapRows` path, compiled projector path, and generated mapper path for the hottest nested DTO shapes.
- The validation target intentionally measures response validation separately from the minimal SQL-first path. Do not include it in the main Drizzle comparison unless the Drizzle target also adds equivalent validation.
