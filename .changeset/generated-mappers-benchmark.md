---
"@rawsql-ts/ztd-cli": minor
---

Add generated row mapper support for RFBA scaffolds.

New RFBA query scaffolds now include a machine-owned `generated/row-mapper.ts` file and use it from the query boundary by default, keeping the public boundary thin while avoiding runtime mapper overhead for standard scaffold output. Generated mapper files include a machine-owned header and are synchronized by `ztd feature generated-mapper generate`; `ztd feature generated-mapper check` fails on drift and prints the regeneration command for CI/test workflows.

List query generated mappers now emit preallocated-loop direct assignment instead of `rows.map(...)` with a per-row helper, preserving the normal scaffold usage model while keeping the generated mapper hot path closer to handwritten row projection.

The repository drift check now includes a real scaffold fixture so `pnpm verify:generated-mapper-drift` exercises a non-skip target in CI. If a generated mapper is stale, the check fails and reports the `ztd feature generated-mapper generate ...` command needed to refresh the machine-owned artifact.

ztd-cli can generate a narrowly scoped one-root/one-collection RFBA row mapper from query boundary metadata. The generated aggregation preserves SQL row order, respects nullable child presence guards, uses direct assignment without object spread in the hot loop, and serializes composite root keys with typed length-prefixed segments so delimiter characters inside key values do not collide. ztd-cli also reports a clear metadata requirement when `*GeneratedMapperMetadata` cannot be parsed.

`ztd model-gen` now preserves PostgreSQL `$n` placeholders when building live metadata probe SQL after named or positional parameter binding.
