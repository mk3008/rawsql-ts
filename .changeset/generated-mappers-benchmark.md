---
"@rawsql-ts/sql-contract": minor
"@rawsql-ts/ztd-cli": minor
---

Add generated row mapper support for RFBA scaffolds and a compiled column-map projector for sql-contract hot paths.

New RFBA query scaffolds now include a machine-owned `generated/row-mapper.ts` file and use it from the query boundary by default, keeping the public boundary thin while avoiding runtime mapper overhead for standard scaffold output. Generated mapper files include a machine-owned header and are synchronized by `ztd feature generated-mapper generate`; `ztd feature generated-mapper check` fails on drift and prints the regeneration command for CI/test workflows.

List query generated mappers now emit preallocated-loop direct assignment instead of `rows.map(...)` with a per-row helper, preserving the normal scaffold usage model while keeping the generated mapper hot path closer to handwritten row projection.

The repository drift check now includes a real scaffold fixture so `pnpm verify:generated-mapper-drift` exercises a non-skip target in CI. If a generated mapper is stale, the check fails and reports the `ztd feature generated-mapper generate ...` command needed to refresh the machine-owned artifact.

sql-contract now exposes explicit `metadata.relations.hasMany` types, and ztd-cli can generate a narrowly scoped one-root/one-collection RFBA row mapper from JSON-compatible query metadata. The generated aggregation preserves SQL row order, respects nullable child presence guards, and uses direct assignment without object spread in the hot loop.

`ztd model-gen` now preserves PostgreSQL `$n` placeholders when building live metadata probe SQL after named or positional parameter binding.

sql-contract now exposes `compileColumnProjector` and `compileColumnMapRowsMapper` so applications can keep explicit column contracts while preparing fast row projection functions at startup. `compileColumnProjector` now rejects non-string column map values instead of silently dropping them.
