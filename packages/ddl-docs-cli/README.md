# @rawsql-ts/ddl-docs-cli

Generate Markdown table definition documents from DDL files.

- DDL is treated as SSOT.
- SQL parsing uses `rawsql-ts`.
- `CREATE TABLE` and `ALTER TABLE ... ADD CONSTRAINT` are applied across the full DDL stream.
- `COMMENT ON TABLE/COLUMN` is parsed via `rawsql-ts`.

## Install

```bash
pnpm --filter @rawsql-ts/ddl-docs-cli build
```

## Usage

```bash
ddl-docs generate --ddl-dir ztd/ddl --out-dir ztd/docs/tables
```

Show help:

```bash
ddl-docs help
ddl-docs help generate
ddl-docs help prune
ddl-docs help check
ddl-docs help concept-map
```

Generated layout:

- `ztd/docs/tables/index.md`
- `ztd/docs/tables/<schema>/index.md`
- `ztd/docs/tables/<schema>/<table>.md`

Options:

- `--ddl-dir <directory>` repeatable recursive directory input
- `--ddl-file <file>` repeatable explicit file input
- `--ddl <file>` alias of `--ddl-file`
- `--ddl-glob <pattern>` repeatable glob pattern input
- `--extensions <csv>` default `.sql`
- `--out-dir <directory>` output root (default `ztd/docs/tables`)
- `--config <path>` optional `ztd.config.json` path
- `--default-schema <name>` schema override for unqualified table names
- `--search-path <csv>` schema search path override
- `--table-docs <path>` optional table documentation metadata JSON for review-only fields such as column samples
- `--relationship <path>` optional DDL relationship metadata JSON for Related Concepts / Processes
- `--concept-relationship <path>` optional concept registry JSON used to generate concept pages
- `--no-index` skip index page generation
- `--strict` fail when warnings exist
- `--column-order <mode>` `definition` (default) or `name`

### Table Docs Metadata

Use `--table-docs <path>` when review-only documentation should be rendered without writing it into database comments.
For example, column samples can be provided from JSON and rendered in the generated table report before the `Comment` column.

```json
{
  "schemaVersion": 1,
  "tables": {
    "public.transfer_active_black": {
      "columns": {
        "source_key_json": {
          "sample": {
            "sales_id": 123
          }
        }
      }
    }
  }
}
```

Design intent can be added without writing it into DB comments:

```json
{
  "schemaVersion": 1,
  "tables": {
    "public.transfer_active_black": {
      "decision": "source_key_hash is kept as a lookup aid, not as identity.",
      "reviewRisk": "identity-boundary",
      "conceptRefs": ["active-black"],
      "processRefs": ["transfer-execution-process"],
      "tradeoff": [
        "Hash lookup improves large-scale search.",
        "Final identity remains source_key_json."
      ],
      "alternativesRejected": [
        "Do not include source_key_hash in unique identity."
      ]
    }
  }
}
```

When `--relationship` and `--concept-relationship` are supplied, generated table pages include Related Concepts / Processes, and review pages are emitted under:

- `<outDir>/concepts/`
- `<outDir>/processes/`

### Concept Map Generation

Use `concept-map` when a human review index should be regenerated from structured concept metadata.
The generated Markdown is not the source of concept truth; concept meanings stay in each `SPEC.md`, and relationship facts stay in `concept-relationship.json`.

```bash
ddl-docs concept-map \
  --concept-relationship packages/transfer/docs/concepts/concept-relationship.json \
  --out packages/transfer/docs/concepts/concept-map.md
```

Prune generated files:

```bash
ddl-docs prune --out-dir ztd/docs/tables
```

Prune preview:

```bash
ddl-docs prune --out-dir ztd/docs/tables --dry-run
```

Optional orphan cleanup:

```bash
ddl-docs prune --out-dir ztd/docs/tables --prune-orphans
```

### Metadata Check

Use `check` to detect stale review metadata before rendering or review.
This command checks structure and references only; it does not judge whether the concept/process meaning is correct.

```bash
ddl-docs check \
  --ddl-dir packages/transfer/db/ddl \
  --table-docs packages/transfer/db/ddl/table-docs.json \
  --relationship packages/transfer/db/ddl/relationship.json \
  --order packages/transfer/db/ddl/order.json \
  --concept-relationship packages/transfer/docs/concepts/concept-relationship.json \
  --concept-map packages/transfer/docs/concepts/concept-map.md \
  --dfd-relationship packages/transfer/docs/dfd/relationship.json \
  --process-dir packages/transfer/docs/processes \
  --default-schema rawsql_transfer
```

Errors are intended for CI failure, such as missing files, stale table/column/index/constraint references, invalid JSON shape, DDL files missing from `order.json`, broken Concept/DFD/Process references, stale generated Concept Map Markdown, or Process Map Markdown files missing from `process-map.json`.
Warnings are review aids, such as important constraints without review notes or JSON columns without samples.

## VitePress Integration

This tool emits plain Markdown files and index pages.
If you prefer VitePress-side navigation generation, run with `--no-index` and let your site config build navigation from the generated table pages.

## Warnings

Warnings are emitted to `<outDir>/_meta/warnings.json`.
Use `--strict` in CI to treat warnings as failures.

## Memory Notes

Current implementation prioritizes correctness by applying the full DDL stream and aggregating table metadata before rendering.
For large schemas (for example, ~300 tables), follow-up optimization should focus on reducing peak memory by keeping only compact table metadata and discarding statement-level objects early.

## Minimal E2E Sample

See `packages/ddl-docs-cli/examples/minimal-e2e`.
